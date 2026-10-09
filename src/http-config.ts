import type { HttpOptions } from "./http.js";

export function httpOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): HttpOptions {
    const integer = (key: string, fallback: number, max: number) => {
        const raw = env[key];
        if (raw === undefined) return fallback;
        if (!/^\d+$/.test(raw)) throw new Error(`Invalid ${key}`);
        const value = Number(raw);
        if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new Error(`Invalid ${key}`);
        return value;
    };
    return {
        host: env.MCP_HTTP_HOST ?? "127.0.0.1",
        allowedHosts: env.MCP_HTTP_ALLOWED_HOSTS?.split(",").map(value => value.trim()).filter(Boolean),
        port: integer("MCP_HTTP_PORT", 38473, 65535),
        maxSessions: integer("MCP_HTTP_MAX_SESSIONS", 64, 10000),
        sessionTimeoutMs: integer("MCP_HTTP_SESSION_TIMEOUT_MS", 600000, 2147483647),
        maxInFlight: integer("MCP_HTTP_MAX_IN_FLIGHT", 64, 10000),
        token: env.MCP_HTTP_TOKEN || undefined,
    };
}
