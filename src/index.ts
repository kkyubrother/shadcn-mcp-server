#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { API_KEY, EMAIL } from "./utils/http-client.js";
import { apiClient } from "./utils/http-client.js";

// Create server instance
const server = new McpServer({
    name: "shadcn-studio MCP Server",
    version: "1.0.0",
});

// A tool to get create Instructions to follow for IDE agent to generate/create/update shadcn/studio blocks.
server.registerTool(
    "get-create-instructions",
    {
        title: "Get Instructions for shadcn/studio.",
        description: "Get instructions for creating Shadcn blocks using existing blocks. This tool provides instructions for creating new Shadcn blocks using existing blocks. Use this tool when the user requests to generate a new component. mentions /create-shadcn or /cui. Strictly follow the steps one by one to ensure successful code generation.Retrieves Instructions for IDE agent to follow for creating/generating/updating shadcn blocks.",
    },
    async () => {
        try {
            const url = `/api/mcp/instructions?path=create-ui.md`;
            const response = await apiClient.get(url);

            if (response.status !== 200) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    }
                ],
            };
        }
        catch (error) {
            console.error("Error fetching block metadata:", error);
            throw new Error("Failed to fetch block metadata");
        }
    }
);

// A tool to get instructions for generating Shadcn blocks using the existing Shadcn blocks as an inspiration.
server.registerTool(
    "get-inspire-instructions",
    {
        title: "Get Instructions for generating Shadcn blocks using the existing Shadcn blocks as an inspiration.",
        description: "Get instructions for working with Shadcn blocks. This tool provides instructions for creating new Shadcn blocks by taking the inspiration from existing Shadcn blocks. Use this tool when the user requests to generate a new component by inspirations. mentions /inspire-shadcn or /iui.",
    },
    async () => {
        try {
            const url = `/api/mcp/instructions?path=inspire-ui.md`;
            const response = await apiClient.get(url);

            if (response.status !== 200) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    }
                ],
            };
        }
        catch (error) {
            console.error("Error fetching block metadata:", error);
            throw new Error("Failed to fetch block metadata");
        }
    }
);

// A tool to get instructions for refining Shadcn blocks.
server.registerTool(
    "get-refine-instructions",
    {
        title: "Get Instructions for refining Shadcn blocks/code/component or page.",
        description: "Get instructions for refining Shadcn blocks. This tool provides instructions for refining existing Shadcn blocks. Use this tool when the user requests to refine an existing component. mentions /refine-shadcn or /rui.",
    },
    async () => {
        try {
            const url = `/api/mcp/instructions?path=refine-ui.md`;
            const response = await apiClient.get(url);

            if (response.status !== 200) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    }
                ],
            };
        }
        catch (error) {
            console.error("Error fetching block metadata:", error);
            throw new Error("Failed to fetch block metadata");
        }
    }
);

// A tool to get the metadata of a block from a given URL.
server.registerTool(
    "get-blocks-metadata",
    {
        title: "Get Block Metadata",
        description: "Fetch the metadata of a block from a given URL. Use this tool to retrieve the block metadata. This will provide the metadata of all the Shadcn blocks available for use.",
    },
    async () => {
        try {
            const url = `/api/mcp/instructions?path=block_metadata.json`;
            const response = await apiClient.get(url);

            if (response.status !== 200) {
                throw new Error(`Failed to fetch block metadata: ${response.status}`);
            }

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    }
                ],
            };
        }
        catch (error) {
            console.error("Error fetching block metadata:", error);
            throw new Error("Failed to fetch block metadata");
        }
    }
);

// A tool to get the metadata of the block.
server.registerTool(
    "get-block-meta-content",
    {
        title: "Get Block Meta Content",
        description: "Fetch the content of the block metadata from the Shadcn MCP server. Use this tool to retrieve the block metadata content.",
        inputSchema: { endpoint: z.string() },
    },
    async ({ endpoint }) => {
        try {
            const url = `/api/mcp${endpoint}`;
            const response = await apiClient.get(url);

            if (response.status !== 200) {
                throw new Error(`Failed to fetch block meta content: ${response.status}`);
            }

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    }
                ],
            };
        }
        catch (error) {
            console.error("Error fetching block meta content:", error);
            throw new Error("Failed to fetch block meta content");
        }
    }
);

// A tool to get the content of a block from a given URL. (CUI)
server.registerTool(
    "get-block-content",
    {
        title: "Get Block Data",
        description: "Fetch the content of a block from a given URL. Use this tool to retrieve the code block content from the authenticated URL.",
        inputSchema: { endpoint: z.string() },
    },
    async ({ endpoint }) => {
        try {
            const url = `/r/blocks/${endpoint}` + `?license_key=${API_KEY?.replace(/"/g, '')}&email=${EMAIL?.replace(/"/g, '')}`;
            const response = await apiClient.get(url);

            if (response.status !== 200) {
                throw new Error(`Failed to fetch block data: ${response.status}`);
            }

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    }
                ],
            };
        }
        catch (error) {
            console.error("Error fetching block data:", error);
            throw new Error("Failed to fetch block data");
        }
    }
);


// IUI
server.registerTool(
    "get-inspiration-block-content",
    {
        title: "Get Inspiration Block Data",
        description: "Fetch the content of an inspiration block from a given URL. Use this tool to retrieve the code block content from the authenticated URL.",
        inputSchema: { endpoint: z.string() },
    },
    async ({ endpoint }) => {
        try {
            const url = `/api/mcp/inspiration?blockPath=${endpoint}` + `&license_key=${API_KEY?.replace(/"/g, '')}&email=${EMAIL?.replace(/"/g, '')}`;
            const response = await apiClient.get(url);

            if (response.status !== 200) {
                throw new Error(`Failed to fetch block data: ${response.status}`);
            }

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    }
                ],
            };
        }
        catch (error) {
            console.error("Error fetching block data:", error);
            throw new Error("Failed to fetch block data");
        }
    }
);

// A tool to get the content of a component from a given URL. (RUI)
server.registerTool(
    "get-component-content",
    {
        title: "Get Component Data",
        description: "Fetch the content of a component from a given URL. Use this tool to retrieve the code block content from the authenticated URL.",
        inputSchema: { endpoint: z.string() },
    },
    async ({ endpoint }) => {
        try {
            const url = `/api/mcp/components?component=${endpoint}`;
            const response = await apiClient.get(url);

            if (response.status !== 200) {
                throw new Error(`Failed to fetch component data: ${response.status}`);
            }

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    }
                ],
            };
        }
        catch (error) {
            console.error("Error fetching block data:", error);
            throw new Error("Failed to fetch block data");
        }
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Shadcn MCP Server is running...");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});