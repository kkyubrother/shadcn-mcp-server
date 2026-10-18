#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server.js";

async function main() {
    const transport = process.argv.find(arg => arg.startsWith("--transport="))?.split("=")[1] ?? "stdio";
    if (transport === "streamable-http") {
        const { startHttpServer } = await import("./http.js");
        const { httpOptionsFromEnv } = await import("./http-config.js");
        const service = await startHttpServer(httpOptionsFromEnv());
        console.error(`Shadcn MCP Streamable HTTP listening at ${service.url}`);
        const shutdown = () => { void service.close().catch(() => { process.exitCode = 1; }); };
        process.once("SIGINT", shutdown);
        process.once("SIGTERM", shutdown);
    } else if (transport === "stdio") {
        await createMcpServer().connect(new StdioServerTransport());
        console.error("Shadcn MCP Server is running...");
    } else {
        throw new Error("Unsupported transport; use stdio or streamable-http");
    }
}
main().catch(() => {
    console.error("Unable to start Shadcn MCP; check transport and HTTP configuration.");
    process.exitCode = 1;
});
