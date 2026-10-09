# Shadcn Studio MCP Server

Build modern, production-ready UI blocks, components, and full pages in minutes using Shadcn Studio. Seamlessly integrates with your favorite IDE and supports the most popular frameworks like React, Next.js.

## 🚀 What is Shadcn Studio MCP Server?

Shadcn Studio MCP Server is a [Shadcn AI](https://shadcnstudio.com/mcp) builder that helps you create, inspire, refine, and convert Figma designs into stunning, production-ready blocks, UI components, and full pages using Shadcn Studio blocks. It easily integrates directly into your favorite IDE for a fast & efficient workflow.

Try Shadcn Studio MCP Server for free today.

## Streamable HTTP (this fork)

This fork adds native Streamable HTTP at `/mcp`. One Node.js process serves
multiple clients; it does **not** spawn a stdio process per client or request.
All 15 upstream tools remain available, and stdio remains the default transport.
The upstream npm package does not include this fork's changes: build this checkout.

### Build and run once

Requires Node.js 20.3+ (Node.js 22 or 24 recommended).

```bash
git clone --branch feat/streamable-http https://github.com/kkyubrother/shadcn-mcp-server.git
cd shadcn-mcp-server
npm ci
npm run build
npm run start:http
```

The endpoint is `http://127.0.0.1:3000/mcp`. Keep this single server running and
configure each client with its URL. Do not launch a copy for each client.

For Pro features, set `API_KEY` and `EMAIL` in the **server process environment**.
CLI `API_KEY=...` / `EMAIL=...` arguments remain supported. No Shadcn credential
is required in each client's MCP configuration. All sessions in this deployment
use the same Shadcn account; this is not a multi-tenant credential service.

### Client configuration

Codex (`~/.codex/config.toml`):

```toml
[mcp_servers.shadcn-studio-mcp]
url = "http://127.0.0.1:3000/mcp"
```

OpenCode (`~/.config/opencode/opencode.json`, merge into existing settings):

```json
{
  "mcp": {
    "shadcn-studio-mcp": {
      "type": "remote",
      "url": "http://127.0.0.1:3000/mcp",
      "oauth": false,
      "enabled": true
    }
  }
}
```

Antigravity (MCP Servers → Manage MCP Servers → View raw config):

```json
{
  "mcpServers": {
    "shadcn-studio-mcp": {
      "serverUrl": "http://127.0.0.1:3000/mcp"
    }
  }
}
```

These are configuration examples. Automated interoperability tests use the
official MCP TypeScript client; individual desktop clients and Pro API access
need separate acceptance testing.

### Session isolation and limits

Each MCP session owns its server object and block/component collections inside
the same process. Session A cannot list, clear, or consume session B's collection.
The transport uses JSON responses for requests and supports the Streamable HTTP
GET event stream. This is not the legacy `/sse` + `/message` transport.

DELETE terminates a session. Idle sessions expire and all transports close on
SIGINT/SIGTERM. An open GET event stream alone does not keep a session alive;
active POST responses defer expiry. Expired IDs return 404 and require a fresh
initialize. Collections are not persisted across expiry or restart.

Multiple agents **sharing the same MCP session** also share its collection.
For independent concurrent workflows on one session, bypass collection tools:
call `get_add_command_for_items` with `useCollectedBlocks: false` and `items`, or
`get_add_command_for_components` with `useCollectedComponents: false` and `items`.
Do not interleave `collect_*` / generate / clear workflows on the same session.

| Server environment variable | Default | Meaning |
| --- | --- | --- |
| `MCP_HTTP_PORT` | `3000` | Loopback listening port |
| `MCP_HTTP_MAX_SESSIONS` | `64` | Maximum live sessions, including initialization |
| `MCP_HTTP_SESSION_TIMEOUT_MS` | `600000` | Idle session lifetime |
| `MCP_HTTP_MAX_IN_FLIGHT` | `64` | Maximum open HTTP requests, including GET streams |
| `MCP_HTTP_TOKEN` | unset | Optional HTTP bearer token (distinct from Shadcn `API_KEY`) |

Excess sessions/requests return 503; bodies are capped at 1 MiB. Each collection
holds at most 100 entries. Upstream HTTP requests have a 30-second deadline.
Resource use still grows with session objects and response sizes; it does not
multiply a full Node runtime per session.

The service binds only to `127.0.0.1`, checks Host and rejects browser Origin
headers. No CORS, remote bind, legacy SSE or OAuth service is provided. For remote
access, use an authenticated TLS reverse proxy that preserves an allowed local
Host header and configure `MCP_HTTP_TOKEN`. Do not expose an unauthenticated proxy.

When using a token, Codex can set `bearer_token_env_var = "MCP_HTTP_TOKEN"` in the
server entry (export that variable in the client environment as well). Other
clients can send `Authorization: Bearer <token>` using their `headers` setting.
The token is shared by this deployment, not a per-session account identity.

### Development

```bash
npm run typecheck
npm test
```

Integration tests cover concurrent clients, collection isolation, explicit-item
calls, deletion, expiry, capacity, malformed requests, authentication, Host/Origin
validation and stdio compatibility. Tests use local-only tools and do not require
credentials or call Shadcn Studio's API.

## 🛠️ Installation

We've made installation super easy!

1. Access the [Installation Guide](https://shadcnstudio.com/mcp/onboarding) and select your IDE (VS Code, Cursor, Windsurf, etc.).
2. Follow the step-by-step instructions to set up the MCP Server in your IDE.
3. Start using Shadcn Studio MCP Server for **free**.

### Quick Setup (npx)

```json
{
  "mcpServers": {
    "shadcn-studio-mcp": {
      "command": "npx",
      "args": ["-y", "shadcn-studio-mcp"]
    }
  }
}
```

### Pro Users (with API Key & Email)

```json
{
  "mcpServers": {
    "shadcn-studio-mcp": {
      "command": "npx",
      "args": ["-y", "shadcn-studio-mcp", "API_KEY=your-api-key", "EMAIL=your@email.com"]
    }
  }
}
```

> **Note:** For freemium features, no credentials are needed. For pro features, both `API_KEY` and `EMAIL` are required.

## 📒 Documentation

Shadcn Studio MCP Server is designed to be intuitive and easy to use. The commands are simple and straightforward, allowing you to create, inspire, refine, and convert Figma designs to UI blocks quickly.

For detailed documentation on how to use Shadcn Studio MCP Server, please refer to the [Shadcn Studio MCP Documentation](https://shadcnstudio.com/docs/getting-started/shadcn-studio-mcp-server).

## 🔧 Usage

Shadcn Studio MCP Server provides four main workflows:

| Command | Description | Use Case |
|---------|-------------|----------|
| `/cui`  | Create UI | Customize and install from existing Shadcn Studio blocks |
| `/iui`  | Inspire UI | Generate new, creative UI blocks inspired by existing ones |
| `/rui`  | Refine UI | Refine, edit, or theme an existing block or page |
| `/ftc`  | Figma to Code | Convert Figma designs blocks directly to Shadcn Studio blocks |

See the complete documentation here: [Shadcn Studio MCP Documentation](https://shadcnstudio.com/docs/getting-started/shadcn-studio-mcp-server).

### Examples

**Create UI (`/cui`):**
```
/cui Create a hero section for an eLearning Academy site.
/cui Create a feature section for my SaaS landing page.
/cui Create a pricing section with a monthly/yearly toggle.
```

**Inspire UI (`/iui`):**
```
/iui Create a hero section for my AI SaaS - AI Video Generator.
/iui Create a feature section for my productivity app.
/iui Build a testimonials section inspired by modern design trends.
```

**Refine UI (`/rui`):**
```
/rui Update the theme to Modern Minimal.
/rui Replace the "Get Started" button with Login and Register buttons.
/rui Update the pricing card to Dynamic 3D Hover Card.
/rui Update the login button to animated ripple style.
```

**Figma to Code (`/ftc`):**
```
/ftc generate code for the selected figma frame using shadcn/studio blocks
/ftc Install matching shadcn/studio blocks for this design
```

## 📚 Documentation & Resources

- [Official Documentation](https://shadcnstudio.com/docs/getting-started/shadcn-studio-mcp-server)
- [Installation Guide](https://shadcnstudio.com/mcp/onboarding)
- [Shadcn Studio Blocks](https://shadcnstudio.com/blocks)
- [Shadcn Studio Components](https://shadcnstudio.com/components)
- [Shadcn Studio Themes](https://shadcnstudio.com/theme-generator)
- [Homepage](https://shadcnstudio.com)

## Community 🤝

Join the Shadcn Studio community to discuss the library, ask questions, and share your experiences:

- 🐦 [Follow us on Twitter](https://x.com/ShadcnStudio)
- 💬 [Discuss on GitHub](https://github.com/shadcnstudio/shadcn-mcp-server/discussions)
- 🎮 [Join us on Discord](https://discord.com/invite/kBHkY7DekX)

## Contributing 📝

Fix a bug, or add a new feature. You can make a pull request and see your code in the next version of Shadcn Studio MCP.

Before adding a pull request, please see the **[contributing guidelines](https://github.com/shadcnstudio/shadcn-studio/blob/main/CONTRIBUTING.md)**.