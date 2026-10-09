import { randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer } from "./server.js";

export interface HttpOptions {
    port?: number;
    maxSessions?: number;
    sessionTimeoutMs?: number;
    maxInFlight?: number;
    token?: string;
}

type Session = {
    server: ReturnType<typeof createMcpServer>;
    transport: StreamableHTTPServerTransport;
    lastActive: number;
    activePosts: number;
    closed: boolean;
};

/** One process, one isolated MCP server per session. No child processes. */
export async function startHttpServer(options: HttpOptions = {}) {
    const { port = 3000, maxSessions = 64, sessionTimeoutMs = 600000, maxInFlight = 64, token } = options;
    for (const value of [maxSessions, sessionTimeoutMs, maxInFlight]) {
        if (!Number.isSafeInteger(value) || value < 1) throw new Error("Invalid HTTP limits");
    }
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid port");
    const sessions = new Map<string, Session>();
    // Includes sessions whose initialization has not completed yet.
    const live = new Set<Session>();
    let closing = false;
    let inFlight = 0;
    const app = express();
    app.disable("x-powered-by");

    const fail = (res: express.Response, status: number, message: string) => {
        res.status(status).json({ jsonrpc: "2.0", error: { code: -32000, message }, id: null });
    };
    app.use((req, res, next) => {
        // Native MCP clients need no browser Origin. Reject browser access and
        // untrusted Host headers even on loopback (DNS rebinding protection).
        if (!["127.0.0.1", "localhost", "[::1]"].includes(req.hostname) || req.headers.origin !== undefined) {
            fail(res, 403, "Host or Origin not allowed");
            return;
        }
        if (token) {
            const actual = Buffer.from(req.headers.authorization ?? "");
            const expected = Buffer.from(`Bearer ${token}`);
            if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
                fail(res, 401, "Unauthorized");
                return;
            }
        }
        if (closing) { fail(res, 503, "Server shutting down"); return; }
        next();
    });
    // Bound body buffering too, not only work after the JSON parser.
    app.use("/mcp", (req, res, next) => {
        if (inFlight >= maxInFlight) { fail(res, 503, "Request limit reached"); return; }
        inFlight++;
        let released = false;
        const release = () => { if (!released) { released = true; inFlight--; } };
        res.once("close", release);
        res.once("finish", release);
        next();
    });
    app.use(express.json({ limit: "1mb" }));

    async function dispose(session: Session) {
        if (session.closed) return;
        session.closed = true;
        live.delete(session);
        if (session.transport.sessionId) sessions.delete(session.transport.sessionId);
        await session.server.close();
    }

    app.all("/mcp", async (req, res) => {
        if (!["POST", "GET", "DELETE"].includes(req.method)) {
            res.setHeader("Allow", "POST, GET, DELETE");
            fail(res, 405, "Method not allowed");
            return;
        }
        const id = req.headers["mcp-session-id"];
        if (id !== undefined && (typeof id !== "string" || !id)) {
            fail(res, 400, "Invalid session ID"); return;
        }
        let session = id ? sessions.get(id) : undefined;
        let fresh = false;
        if (id && !session) { fail(res, 404, "Session not found"); return; }
        if (!session) {
            if (req.method !== "POST" || !isInitializeRequest(req.body)) {
                fail(res, 400, "Initialize a session first"); return;
            }
            if (live.size >= maxSessions) { fail(res, 503, "Session limit reached"); return; }
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                enableJsonResponse: true,
                onsessioninitialized: sessionId => { sessions.set(sessionId, session!); },
            });
            session = { server: createMcpServer(), transport, lastActive: Date.now(), activePosts: 0, closed: false };
            live.add(session);
            fresh = true;
            try {
                await session.server.connect(transport);
                // Preserve the SDK's close callback so pending work is cancelled.
                const onclose = transport.onclose;
                transport.onclose = () => {
                    session!.closed = true;
                    live.delete(session!);
                    if (transport.sessionId) sessions.delete(transport.sessionId);
                    onclose?.();
                };
            } catch {
                await dispose(session);
                fail(res, 500, "Session initialization failed"); return;
            }
        }
        const current = session;
        current.lastActive = Date.now();
        const post = req.method === "POST";
        if (post) current.activePosts++;
        let ended = false;
        const end = () => {
            if (ended) return;
            ended = true;
            if (post) current.activePosts--;
            current.lastActive = Date.now();
        };
        res.once("finish", end);
        res.once("close", end);
        try {
            await current.transport.handleRequest(req, res, req.body);
            if (fresh && !current.transport.sessionId) await dispose(current);
        } catch {
            await dispose(current);
            if (!res.headersSent) fail(res, 500, "MCP request failed");
            else res.end();
        }
    });
    app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        fail(res, error.status === 413 ? 413 : 400, "Invalid request body");
    });

    const http = createServer(app);
    http.requestTimeout = 30000;
    http.headersTimeout = 10000;
    await new Promise<void>((resolve, reject) => {
        http.once("error", reject);
        http.listen(port, "127.0.0.1", () => { http.off("error", reject); resolve(); });
    });
    const address = http.address();
    if (!address || typeof address === "string") throw new Error("Missing HTTP address");
    const timer = setInterval(() => {
        const now = Date.now();
        for (const session of live) {
            if (!session.activePosts && now - session.lastActive >= sessionTimeoutMs) {
                void dispose(session).catch(() => console.error("Failed to close expired MCP session"));
            }
        }
    }, Math.min(sessionTimeoutMs, 30000));
    timer.unref();
    let closePromise: Promise<void> | undefined;
    return {
        url: `http://127.0.0.1:${address.port}/mcp`,
        get sessionCount() { return live.size; },
        close() {
            return closePromise ??= (async () => {
                closing = true;
                clearInterval(timer);
                const stopped = new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve()));
                await Promise.allSettled([...live].map(dispose));
                http.closeAllConnections();
                await stopped;
            })();
        },
    };
}
