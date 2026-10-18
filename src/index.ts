#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { apiGet } from "./utils/http-client.js";
import { handleMcpError } from "./utils/errors.js";
import { figmaToBlockName, formatThemeName, toRegistryItem, REGISTRY_STYLE } from "./utils/validation.js";

const server = new McpServer({
    name: "shadcn-studio MCP Server",
    version: "1.0.7",
});

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });
const json = (value: unknown) => text(JSON.stringify(value, null, 2));

// Fetch an endpoint and return its body as JSON text, or the error as an MCP error response
async function fetchJson(url: string) {
    try {
        const response = await apiGet(url);
        return json(response.data);
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        return handleMcpError(error);
    }
}

const installCommand = (items: string[]) => `npx shadcn@latest add ${items.join(" ")}`;

// In-memory collection of selected items, cleared after 10 minutes of inactivity
// or once an install command has been generated
const COLLECTION_TIMEOUT_MS = 10 * 60 * 1000;

function createCollection(noun: "block" | "component") {
    const Noun = noun[0].toUpperCase() + noun.slice(1);
    const listKey = `collected${Noun}s`;
    const totalKey = `total${Noun}s`;

    let items: Record<string, string>[] = [];
    let lastUpdated = 0;

    const reset = () => {
        items = [];
        lastUpdated = 0;
    };

    const clearIfStale = () => {
        if (items.length > 0 && Date.now() - lastUpdated > COLLECTION_TIMEOUT_MS) reset();
    };

    const state = () => ({
        [listKey]: items,
        [totalKey]: items.length,
        readyForCommand: items.length > 0,
        sessionInfo: lastUpdated > 0
            ? {
                lastUpdated: new Date(lastUpdated).toISOString(),
                timeoutMinutes: COLLECTION_TIMEOUT_MS / (60 * 1000),
            }
            : null,
    });

    return {
        manage(name: string, type: string, action: "add" | "list" | "clear") {
            clearIfStale();

            if (action === "list") return json(state());

            if (action === "clear") {
                reset();
                return json({
                    message: `${Noun} collection cleared`,
                    [listKey]: [],
                    [totalKey]: 0,
                    readyForCommand: false,
                });
            }

            // Replace the item of the same type, or add a new one
            const item = { [`${noun}Name`]: name, [`${noun}Type`]: type };
            const existingIndex = items.findIndex((existing) => existing[`${noun}Type`] === type);
            if (existingIndex >= 0) {
                items[existingIndex] = item;
            } else {
                items.push(item);
            }
            lastUpdated = Date.now();

            return json({ message: `${Noun} '${name}' (${type}) added to collection`, ...state() });
        },

        command(useCollected: boolean, customItems: string[]) {
            clearIfStale();

            if (!useCollected) return text(installCommand(customItems));

            if (items.length === 0) {
                return json({
                    error: `No ${noun}s have been collected yet`,
                    suggestion: `Use collect_selected_${noun}s to add ${noun}s first, then generate the command`,
                    [listKey]: items,
                    [totalKey]: 0,
                });
            }

            // Add the @shadcn-studio/ namespace, rewriting legacy @ss-blocks/ / @ss-components/ names
            const names = items.map(({ [`${noun}Name`]: itemName }) => toRegistryItem(itemName));
            reset();
            return text(installCommand(names));
        },
    };
}

const blocks = createCollection("block");
const components = createCollection("component");

// Instructions for IDE agent to generate/create/update shadcn/studio blocks.
server.registerTool(
    "get-create-instructions",
    {
        title: "Get Instructions for shadcn/studio.",
        description:
            "Get instructions for creating Shadcn blocks using existing blocks. This tool provides instructions for creating new Shadcn blocks using existing blocks. Use this tool when the user requests to generate a new component. mentions /create-shadcn or /cui. Strictly follow the steps one by one to ensure successful code generation.Retrieves Instructions for IDE agent to follow for creating/generating/updating shadcn blocks.",
    },
    () => fetchJson("/api/mcp/instructions?path=create-ui.md")
);

server.registerTool(
    "get-inspire-instructions",
    {
        title:
            "Get Instructions for generating Shadcn blocks using the existing Shadcn blocks as an inspiration.",
        description:
            "Get instructions for working with Shadcn blocks. This tool provides instructions for creating new Shadcn blocks by taking the inspiration from existing Shadcn blocks. Use this tool when the user requests to generate a new component by inspirations. mentions /inspire-shadcn or /iui. The instructions will guide you to use IUI-specific tools: get-blocks-metadata, get-inspiration-block-content.",
    },
    () => fetchJson("/api/mcp/instructions?path=inspire-ui.md")
);

server.registerTool(
    "get-refine-instructions",
    {
        title:
            "Get Instructions for refining Shadcn blocks/code/component or page.",
        description:
            "Get instructions for refining Shadcn blocks. This tool provides instructions for refining existing Shadcn blocks. Use this tool when the user requests to refine an existing component. mentions /refine-shadcn or /rui.",
    },
    () => fetchJson("/api/mcp/instructions?path=refine-ui.md")
);

server.registerTool(
    "get-ftc-instructions",
    {
        title:
            "Get Instructions for Figma to Code workflow.",
        description:
            "Get instructions for converting Figma designs to code using Shadcn blocks. This tool provides step-by-step instructions for the Figma to Code workflow. Use this tool when the user requests to convert Figma design to code. mentions /figma-to-code or /ftc. The workflow involves: 1) Using Figma MCP to list Pro/Free Blocks component instances, 2) Using our MCP to install matching blocks, 3) Building the page structure, 4) Replacing content from Figma.",
    },
    () => fetchJson("/api/mcp/instructions?path=figma-to-code-ui.md")
);

server.registerTool(
    "get-blocks-metadata",
    {
        title: "Get Blocks Metadata",
        description:
            "FOR CREATE_UI (/cui) AND INSPIRATION UI (/iui) : Retrieve metadata of all available blocks. Returns list of available blocks with names, descriptions, and categories.",
        inputSchema: {},
    },
    () => fetchJson("/api/mcp/instructions?path=block_metadata.json")
);

// Parse Figma component names and convert to Shadcn Studio block format (FTC)
server.registerTool(
    "parse-figma-blocks",
    {
        title: "Parse Figma Component Names (FIGMA-TO-CODE WORKFLOW)",
        description:
            "FOR FIGMA-TO-CODE WORKFLOW (/ftc): Parse Figma component instance names and convert them to proper Shadcn Studio block format for installation. Converts names like 'Pro Blocks / Marketing-ui / features-section / Feature 01' to '@shadcn-studio/features-section-01' or 'Free Blocks / Marketing-ui / hero-section / Hero 3' to '@shadcn-studio/hero-section-03'. Use this tool after getting component list from Figma MCP. DO NOT use for create-ui, inspire-ui, or refine-ui workflows.",
        inputSchema: {
            figmaComponents: z.array(z.string()).describe("Array of Figma component instance names from Figma MCP (e.g., ['Pro Blocks / Marketing-ui / features-section / Feature 01', 'Pro Blocks / Marketing-ui / hero-section / Hero 03'])"),
        },
    },
    async ({ figmaComponents }) => {
        if (figmaComponents.length === 0) {
            return json({
                error: "No Figma components provided",
                suggestion: "Use Figma MCP first to get the list of component instances from the selected frame",
                parsedBlocks: [],
            });
        }

        // "Pro Blocks / Marketing-ui / features-section / Feature 01" -> "features-section-01"
        const parsedBlocks = figmaComponents.map((componentName) => {
            const parts = componentName.split('/').map((part) => part.trim());
            const blockName = figmaToBlockName(componentName);

            return {
                original: componentName,
                blockName,
                namespace: toRegistryItem(blockName),
                category: parts.length > 2 && parts[parts.length - 2],
            };
        });

        return json({
            success: true,
            totalComponents: figmaComponents.length,
            parsedBlocks,
            nextSteps: [
                "Use collect_selected_blocks to add these blocks to collection",
                "After collecting all blocks, use get_add_command_for_items to generate installation command"
            ],
        });
    }
);

server.registerTool(
    "get-block-meta-content",
    {
        title: "Get Block Meta Content (CREATE-UI WORKFLOW)",
        description:
            "FOR CREATE-UI WORKFLOW (/cui): Fetch detailed information about blocks in a specific category for installation. Use this to explore and select the most suitable block for installation. DO NOT use for inspire-ui workflow.",
        inputSchema: { endpoint: z.string() },
    },
    ({ endpoint }) => fetchJson(`/api/mcp${endpoint}`)
);

server.registerTool(
    "collect_selected_blocks",
    {
        title: "Collect Selected Blocks (CREATE-UI & FTC WORKFLOW)",
        description:
            "FOR CREATE-UI WORKFLOW (/cui) AND FIGMA-TO-CODE WORKFLOW (/ftc): Collect and store selected blocks for batch installation command generation. Use this tool after selecting a specific block from get-block-meta-content (for /cui) or after parsing Figma components with parse-figma-blocks (for /ftc). This tool accumulates blocks until all required blocks are selected, then allows final command generation. DO NOT use for inspire-ui workflow.",
        inputSchema: {
            blockName: z
                .string()
                .describe(
                    "The name of the selected block (e.g., 'hero-section-01', 'navbar-component-13', 'feature-01')"
                ),
            blockType: z
                .string()
                .describe(
                    "The type/category of the block (e.g., 'hero', 'navbar', 'pricing', 'footer', 'features-section')"
                ),
            action: z
                .enum(["add", "list", "clear"])
                .describe(
                    "Action to perform: 'add' to add a block, 'list' to show collected blocks, 'clear' to reset the collection"
                ),
        },
    },
    async ({ blockName, blockType, action }) => blocks.manage(blockName, blockType, action)
);

server.registerTool(
    "get_add_command_for_items",
    {
        title: "Generate Installation Command (CREATE-UI & FTC WORKFLOW)",
        description:
            "FOR CREATE-UI WORKFLOW (/cui) AND FIGMA-TO-CODE WORKFLOW (/ftc): Generate the shadcn CLI add command for all collected blocks. This returns the exact command that should be executed to install the components. DO NOT use for inspire-ui workflow.",
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
    async ({ useCollectedBlocks = true, items = [] }) => blocks.command(useCollectedBlocks, items)
);

server.registerTool(
    "get-inspiration-block-content",
    {
        title: "Get Inspiration Block Data (INSPIRE-UI WORKFLOW)",
        description:
            "FOR INSPIRE-UI WORKFLOW (/iui): Fetch the content of an inspiration block from a given URL. Use this tool to retrieve the code block content for inspiration and analysis purposes only. DO NOT use for create-ui or refine-ui workflows.",
        inputSchema: { endpoint: z.string() },
    },
    ({ endpoint }) => fetchJson(`/api/mcp/inspiration?blockPath=${endpoint}`)
);

server.registerTool(
    "get-component-meta-content",
    {
        title: "Search Component Metadata (REFINE WORKFLOW ONLY)",
        description:
            "FOR REFINE WORKFLOW ONLY: Search and find the most appropriate component from user query. This tool searches through available components metadata to identify which component is most suitable for the user's requirements. Use this tool first to discover suitable components before using get-component-content. This tool is ONLY for the refine workflow (/rui). DO NOT use this for create-ui workflow - use get-block-meta-content instead.",
        inputSchema: { endpoint: z.string() },
    },
    ({ endpoint }) => fetchJson(`/api/mcp/components?component=${endpoint}`)
);

server.registerTool(
    "get-component-content",
    {
        title: "Get Component Content & Install Command (REFINE WORKFLOW ONLY)",
        description:
            "FOR REFINE WORKFLOW ONLY: If a component was found from get-component-meta-content tool, this tool fetches the component content and generates the shadcn CLI installation command for that component. If no suitable component is found, this tool will help create/update components according to the user query. This returns the exact command that should be executed to install the components. This tool is ONLY for the refine workflow (/rui). DO NOT use this for create-ui workflow - use get-block-content instead.",
        inputSchema: { endpoint: z.string() },
    },
    ({ endpoint }) => fetchJson(`/r/${REGISTRY_STYLE}/${endpoint}.json`)
);

server.registerTool(
    "collect_selected_components",
    {
        title: "Collect Selected Components (REFINE-UI WORKFLOW)",
        description:
            "FOR REFINE-UI WORKFLOW (/rui): Collect and store selected components for batch installation command generation. Use this tool after selecting a specific component from get-component-meta-content. This tool accumulates components until all required components are selected, then allows final command generation. DO NOT use for create-ui or inspire-ui workflows.",
        inputSchema: {
            componentName: z
                .string()
                .describe(
                    "The name of the selected component (e.g., 'button-44', 'alert-12', 'card-05')"
                ),
            componentType: z
                .string()
                .describe(
                    "The type/category of the component (e.g., 'button', 'alert', 'card', 'input')"
                ),
            action: z
                .enum(["add", "list", "clear"])
                .describe(
                    "Action to perform: 'add' to add a component, 'list' to show collected components, 'clear' to reset the collection"
                ),
        },
    },
    async ({ componentName, componentType, action }) => components.manage(componentName, componentType, action)
);

server.registerTool(
    "get_add_command_for_components",
    {
        title: "Generate Component Installation Command (REFINE-UI WORKFLOW)",
        description:
            "FOR REFINE-UI WORKFLOW (/rui): Generate the shadcn CLI add command for all collected components. This returns the exact command that should be executed to install the components. DO NOT use for create-ui or inspire-ui workflows.",
        inputSchema: {
            useCollectedComponents: z
                .boolean()
                .optional()
                .default(true)
                .describe(
                    "Whether to use the collected components (default: true) or provide custom items"
                ),
            items: z
                .array(z.string())
                .optional()
                .describe(
                    "Array of items to get the add command for (only used if useCollectedComponents is false)"
                ),
        },
    },
    async ({ useCollectedComponents = true, items = [] }) => components.command(useCollectedComponents, items)
);

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
        const formattedThemeName = formatThemeName(themeName);
        const themeNamespace = toRegistryItem(formattedThemeName);

        return json({
            success: true,
            command: installCommand([themeNamespace]),
            originalThemeName: themeName,
            formattedThemeName,
            themeNamespace,
            message: `Ready to install theme '${formattedThemeName}'`,
            instructions: "Execute the provided command to install the theme to your project"
        });
    }
);

async function main() {
    await server.connect(new StdioServerTransport());
    console.error("Shadcn MCP Server is running...");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
