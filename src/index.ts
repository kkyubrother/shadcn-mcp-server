#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { API_KEY, EMAIL } from "./utils/http-client.js";
import { apiClient } from "./utils/http-client.js";
import { handleMcpError } from "./utils/errors.js";
import { Validator, formatThemeName, getThemeNamespace } from "./utils/validation.js";

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
        description:
            "Get instructions for creating Shadcn blocks using existing blocks. This tool provides instructions for creating new Shadcn blocks using existing blocks. Use this tool when the user requests to generate a new component. mentions /create-shadcn or /cui. Strictly follow the steps one by one to ensure successful code generation.Retrieves Instructions for IDE agent to follow for creating/generating/updating shadcn blocks.",
    },
    async () => {
        try {
            const url = `/api/mcp/instructions?path=create-ui.md`;
            const response = await apiClient.get(url);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    },
                ],
            };
        } catch (error) {
            console.error("Error fetching create instructions:", error);
            const errorResponse = handleMcpError(error);
            return {
                content: errorResponse.content,
                isError: errorResponse.isError,
            };
        }
    }
);

// A tool to get instructions for generating Shadcn blocks using the existing Shadcn blocks as an inspiration.
server.registerTool(
    "get-inspire-instructions",
    {
        title:
            "Get Instructions for generating Shadcn blocks using the existing Shadcn blocks as an inspiration.",
        description:
            "Get instructions for working with Shadcn blocks. This tool provides instructions for creating new Shadcn blocks by taking the inspiration from existing Shadcn blocks. Use this tool when the user requests to generate a new component by inspirations. mentions /inspire-shadcn or /iui. The instructions will guide you to use IUI-specific tools: get-blocks-metadata, get-inspiration-block-content.",
    },
    async () => {
        try {
            const url = `/api/mcp/instructions?path=inspire-ui.md`;
            const response = await apiClient.get(url);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    },
                ],
            };
        } catch (error) {
            console.error("Error fetching inspire instructions:", error);
            const errorResponse = handleMcpError(error);
            return {
                content: errorResponse.content,
                isError: errorResponse.isError,
            };
        }
    }
);

// A tool to get instructions for refining Shadcn blocks.
server.registerTool(
    "get-refine-instructions",
    {
        title:
            "Get Instructions for refining Shadcn blocks/code/component or page.",
        description:
            "Get instructions for refining Shadcn blocks. This tool provides instructions for refining existing Shadcn blocks. Use this tool when the user requests to refine an existing component. mentions /refine-shadcn or /rui.",
    },
    async () => {
        try {
            const url = `/api/mcp/instructions?path=refine-ui.md`;
            const response = await apiClient.get(url);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    },
                ],
            };
        } catch (error) {
            console.error("Error fetching refine instructions:", error);
            const errorResponse = handleMcpError(error);
            return {
                content: errorResponse.content,
                isError: errorResponse.isError,
            };
        }
    }
);

// A tool to get the metadata of a block from a given URL.
server.registerTool(
    "get-blocks-metadata",
    {
        title: "Get Blocks Metadata",
        description:
            "FOR CREATE_UI (/cui) AND INSPIRATION UI (/iui) : Retrieve metadata of all available blocks. Returns list of available blocks with names, descriptions, and categories.",
        inputSchema: {},
    },
    async () => {
        try {
            const url = `/api/mcp/instructions?path=block_metadata.json`;
            const response = await apiClient.get(url);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    },
                ],
            };
        } catch (error) {
            console.error("Error fetching block metadata:", error);
            const errorResponse = handleMcpError(error);
            return {
                content: errorResponse.content,
                isError: errorResponse.isError,
            };
        }
    }
);

// A tool to get the metadata of the block. (FOR CREATE-UI WORKFLOW)
server.registerTool(
    "get-block-meta-content",
    {
        title: "Get Block Meta Content (CREATE-UI WORKFLOW)",
        description:
            "FOR CREATE-UI WORKFLOW (/cui): Fetch detailed information about blocks in a specific category for installation. Use this to explore and select the most suitable block for installation. DO NOT use for inspire-ui workflow.",
        inputSchema: { endpoint: z.string() },
    },
    async ({ endpoint }) => {
        try {
            const url = `/api/mcp${endpoint}`;
            const response = await apiClient.get(url);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    },
                ],
            };
        } catch (error) {
            console.error("Error fetching block meta content:", error);
            const errorResponse = handleMcpError(error);
            return {
                content: errorResponse.content,
                isError: errorResponse.isError,
            };
        }
    }
);

// Simple in-memory storage for collected blocks with session management
let collectedBlocks: Array<{ blockName: string; blockType: string }> = [];
let lastCollectionTime: number = 0;
const COLLECTION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes timeout

// Helper function to check and clear stale collections
function checkAndClearStaleCollection(): void {
    const now = Date.now();
    if (
        collectedBlocks.length > 0 &&
        now - lastCollectionTime > COLLECTION_TIMEOUT_MS
    ) {
        collectedBlocks = [];
        lastCollectionTime = 0;
    }
}

// A tool to collect selected blocks before generating final command (FOR CREATE-UI WORKFLOW)
server.registerTool(
    "collect_selected_blocks",
    {
        title: "Collect Selected Blocks (CREATE-UI WORKFLOW)",
        description:
            "FOR CREATE-UI WORKFLOW (/cui): Collect and store selected blocks for batch installation command generation. Use this tool after selecting a specific block from get-block-meta-content. This tool accumulates blocks until all required blocks are selected, then allows final command generation. DO NOT use for inspire-ui workflow.",
        inputSchema: {
            blockName: z
                .string()
                .describe(
                    "The name of the selected block (e.g., 'hero-section-01', 'navbar-component-13')"
                ),
            blockType: z
                .string()
                .describe(
                    "The type/category of the block (e.g., 'hero', 'navbar', 'pricing', 'footer')"
                ),
            action: z
                .enum(["add", "list", "clear"])
                .describe(
                    "Action to perform: 'add' to add a block, 'list' to show collected blocks, 'clear' to reset the collection"
                ),
        },
    },
    async ({ blockName, blockType, action }) => {
        try {
            // Check for stale collections before any operation
            checkAndClearStaleCollection();

            switch (action) {
                case "add":
                    // Add the block to collection
                    const existingIndex = collectedBlocks.findIndex(
                        (block) => block.blockType === blockType
                    );

                    if (existingIndex >= 0) {
                        // Replace if same type exists
                        collectedBlocks[existingIndex] = { blockName, blockType };
                    } else {
                        // Add new block
                        collectedBlocks.push({ blockName, blockType });
                    }

                    // Update the last collection time
                    lastCollectionTime = Date.now();

                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify(
                                    {
                                        message: `Block '${blockName}' (${blockType}) added to collection`,
                                        collectedBlocks: collectedBlocks,
                                        totalBlocks: collectedBlocks.length,
                                        readyForCommand: collectedBlocks.length > 0,
                                        sessionInfo: {
                                            lastUpdated: new Date(lastCollectionTime).toISOString(),
                                            timeoutMinutes: COLLECTION_TIMEOUT_MS / (60 * 1000),
                                        },
                                    },
                                    null,
                                    2
                                ),
                            },
                        ],
                    };

                case "list":
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify(
                                    {
                                        collectedBlocks: collectedBlocks,
                                        totalBlocks: collectedBlocks.length,
                                        readyForCommand: collectedBlocks.length > 0,
                                        sessionInfo:
                                            lastCollectionTime > 0
                                                ? {
                                                    lastUpdated: new Date(
                                                        lastCollectionTime
                                                    ).toISOString(),
                                                    timeoutMinutes: COLLECTION_TIMEOUT_MS / (60 * 1000),
                                                }
                                                : null,
                                    },
                                    null,
                                    2
                                ),
                            },
                        ],
                    };

                case "clear":
                    collectedBlocks = [];
                    lastCollectionTime = 0;
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify(
                                    {
                                        message: "Block collection cleared",
                                        collectedBlocks: [],
                                        totalBlocks: 0,
                                        readyForCommand: false,
                                    },
                                    null,
                                    2
                                ),
                            },
                        ],
                    };

                default:
                    throw new Error("Invalid action");
            }
        } catch (error) {
            console.error("Error in collect_selected_blocks:", error);
            throw new Error("Failed to manage block collection");
        }
    }
);

server.registerTool(
    "get_add_command_for_items",
    {
        title: "Generate Installation Command (CREATE-UI WORKFLOW)",
        description:
            "FOR CREATE-UI WORKFLOW (/cui): Generate the shadcn CLI add command for all collected blocks. This returns the exact command that should be executed to install the components. DO NOT use for inspire-ui workflow.",
        inputSchema: {
            useCollectedBlocks: z
                .boolean()
                .optional()
                .default(true)
                .describe(
                    "Whether to use the collected blocks (default: true) or provide custom items"
                ),
            items: z
                .array(z.string())
                .optional()
                .describe(
                    "Array of items to get the add command for (only used if useCollectedBlocks is false)"
                ),
        },
    },
    async ({ useCollectedBlocks = true, items = [] }) => {
        try {
            // Check for stale collections before processing
            checkAndClearStaleCollection();

            let blocksToProcess: string[] = [];

            if (useCollectedBlocks) {
                // Use the collected blocks
                if (!collectedBlocks || collectedBlocks.length === 0) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify(
                                    {
                                        error: "No blocks have been collected yet",
                                        suggestion:
                                            "Use collect_selected_blocks to add blocks first, then generate the command",
                                        collectedBlocks: collectedBlocks,
                                        totalBlocks: 0,
                                    },
                                    null,
                                    2
                                ),
                            },
                        ],
                    };
                }

                // Convert collected blocks to the format expected
                blocksToProcess = collectedBlocks.map(
                    (block) => `@ss-blocks/${block.blockName}`
                );
            } else {
                // Use provided items
                blocksToProcess = items;
            }

            // Generate the command - exactly like shadcn MCP does it
            const command = `npx shadcn@latest add ${blocksToProcess.join(" ")}`;

            // Auto-clear the collected blocks after successful command generation
            // This prevents blocks from persisting across different chat sessions
            if (useCollectedBlocks && collectedBlocks.length > 0) {
                collectedBlocks = []; // Clear the collection
                lastCollectionTime = 0; // Reset timestamp
            }

            return {
                content: [
                    {
                        type: "text",
                        text: command,
                    },
                ],
            };
        } catch (error) {
            console.error("Error generating add commands:", error);
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: Failed to generate add commands - ${error instanceof Error ? error.message : String(error)
                            }`,
                    },
                ],
                isError: true,
            };
        }
    }
);

// IUI
server.registerTool(
    "get-inspiration-block-content",
    {
        title: "Get Inspiration Block Data (INSPIRE-UI WORKFLOW)",
        description:
            "FOR INSPIRE-UI WORKFLOW (/iui): Fetch the content of an inspiration block from a given URL. Use this tool to retrieve the code block content for inspiration and analysis purposes only. DO NOT use for create-ui or refine-ui workflows.",
        inputSchema: { endpoint: z.string() },
    },
    async ({ endpoint }) => {
        try {
            const url = `/api/mcp/inspiration?blockPath=${endpoint}` + `&license_key=${API_KEY?.replace(/"/g, '')}&email=${EMAIL?.replace(/"/g, '')}`;
            const response = await apiClient.get(url);
            Validator.validateHttpResponse(response.status, url);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    },
                ],
            };
        } catch (error) {
            console.error("Error fetching block data:", error);
            const errorResponse = handleMcpError(error);
            return {
                content: errorResponse.content,
                isError: errorResponse.isError,
            };
        }
    }
);

// A tool to get the content of a component from a given URL. (RUI - REFINE USE CASE ONLY)
server.registerTool(
    "get-component-meta-content",
    {
        title: "Search Component Metadata (REFINE WORKFLOW ONLY)",
        description:
            "FOR REFINE WORKFLOW ONLY: Search and find the most appropriate component from user query. This tool searches through available components metadata to identify which component is most suitable for the user's requirements. Use this tool first to discover suitable components before using get-component-content. This tool is ONLY for the refine workflow (/rui). DO NOT use this for create-ui workflow - use get-block-meta-content instead.",
        inputSchema: { endpoint: z.string() },
    },
    async ({ endpoint }) => {
        try {
            const url = `/api/mcp/components?component=${endpoint}`;
            const response = await apiClient.get(url);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    },
                ],
            };
        } catch (error) {
            console.error("Error fetching component data:", error);
            const errorResponse = handleMcpError(error);
            return {
                content: errorResponse.content,
                isError: errorResponse.isError,
            };
        }
    }
);

// A tool to get the content of a component from a given URL. (RUI - REFINE USE CASE ONLY)
server.registerTool(
    "get-component-content",
    {
        title: "Get Component Content & Install Command (REFINE WORKFLOW ONLY)",
        description:
            "FOR REFINE WORKFLOW ONLY: If a component was found from get-component-meta-content tool, this tool fetches the component content and generates the shadcn CLI installation command for that component. If no suitable component is found, this tool will help create/update components according to the user query. This returns the exact command that should be executed to install the components. This tool is ONLY for the refine workflow (/rui). DO NOT use this for create-ui workflow - use get-block-content instead.",
        inputSchema: { endpoint: z.string() },
    },
    async ({ endpoint }) => {
        try {
            const url =
                `/r/components/${endpoint}` +
                `?license_key=${API_KEY?.replace(/"/g, "")}&email=${EMAIL?.replace(/"/g, "")}`;
            const response = await apiClient.get(url);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    },
                ],
            };
        } catch (error) {
            console.error("Error fetching component data:", error);
            const errorResponse = handleMcpError(error);
            return {
                content: errorResponse.content,
                isError: errorResponse.isError,
            };
        }
    }
);

// A tool to install themes from Shadcn Studio (RUI - REFINE USE CASE ONLY)
server.registerTool(
    "install-theme",
    {
        title: "Install Shadcn Studio Theme (REFINE WORKFLOW ONLY)",
        description:
            "FOR REFINE WORKFLOW ONLY (/rui): Install a theme from Shadcn Studio using the appropriate package manager. Supports both public themes (e.g., 'modern-minimal') and private user themes (UUID format). Automatically detects the project's package manager (npm, pnpm, yarn, bun) and generates the correct installation command. DO NOT use this for create-ui (/cui) or inspire-ui (/iui) workflows.",
        inputSchema: {
            themeName: z.string().describe("The name or UUID of the theme to install (e.g., 'modern-minimal' for public themes or UUID for private themes)")
        },
    },
    async ({ themeName }) => {
        try {
            // Format the theme name (converts "Modern Minimal" to "modern-minimal")
            const formattedThemeName = formatThemeName(themeName);

            // Get the proper theme namespace
            const themeNamespace = getThemeNamespace(formattedThemeName);

            // Generate the installation command
            const installCommand = `npx shadcn@latest add ${themeNamespace}`;

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            command: installCommand,
                            originalThemeName: themeName,
                            formattedThemeName: formattedThemeName,
                            themeNamespace: themeNamespace,
                            message: `Ready to install theme '${formattedThemeName}'`,
                            instructions: "Execute the provided command to install the theme to your project"
                        }, null, 2),
                    },
                ],
            };
        } catch (error) {
            console.error("Error generating theme install command:", error);
            const errorResponse = handleMcpError(error);
            return {
                content: errorResponse.content,
                isError: errorResponse.isError,
            };
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
