# Shadcn Studio MCP Server — Streamable HTTP fork

A fork of [shadcnstudio/shadcn-mcp-server](https://github.com/shadcnstudio/shadcn-mcp-server)
that lets Claude Code, Codex, OpenCode and Antigravity connect to one shared local
HTTP server. It retrieves Shadcn Studio instructions, metadata and component code,
manages selections, and returns installation commands for your agent to execute.
Existing stdio usage remains supported.

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

The endpoint is `http://127.0.0.1:38473/mcp`. Keep this single server running and
configure each client with its URL. Do not launch a copy for each client.

For Pro features, set `API_KEY` and `EMAIL` in the **server process environment**.
CLI `API_KEY=...` / `EMAIL=...` arguments remain supported. No Shadcn credential
is required in each client's MCP configuration. All sessions in this deployment
use the same Shadcn account; this is not a multi-tenant credential service.

### Client configuration

Start the server above before connecting. If you changed `MCP_HTTP_PORT`, use
that port in every client URL. The default `38473` avoids common development
ports but is not reserved; choose another port if it is already in use.
Replace existing stdio entries instead of keeping a second copy under another name.

#### Claude Code

Register the running HTTP server for your user (all projects):

```bash
claude mcp add --transport http --scope user shadcn-studio-mcp http://127.0.0.1:38473/mcp
```

If the same name is already registered with `--scope user` using stdio, remove
that entry first, then run the HTTP registration command above:

```bash
claude mcp remove --scope user shadcn-studio-mcp
```

If your old entry is project- or local-scoped, update that scope instead; a
higher-priority entry can override the user-scoped server. Use `--scope project`
in place of `--scope user` to save configuration in the project's `.mcp.json`.

When the server uses `MCP_HTTP_TOKEN`, use this registration command instead.
Export the same token in the terminal where you run this command:

```bash
claude mcp add \
  --header "Authorization: Bearer ${MCP_HTTP_TOKEN:?Set the server token first}" \
  --transport http --scope user \
  shadcn-studio-mcp http://127.0.0.1:38473/mcp
```

The shell expands the token before registration, so this stores its value in
Claude Code's MCP configuration. This token authenticates to your local server;
Shadcn `API_KEY` and `EMAIL` belong in the server environment.

Check registration with `claude mcp get shadcn-studio-mcp`, and use `/mcp` inside
Claude Code to check the connection and available tools. This server does not
provide OAuth login. See the [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp).

#### Codex

Codex (`~/.codex/config.toml`):

```toml
[mcp_servers.shadcn-studio-mcp]
url = "http://127.0.0.1:38473/mcp"
```

#### OpenCode

OpenCode (`~/.config/opencode/opencode.json`, merge into existing settings):

```json
{
  "mcp": {
    "shadcn-studio-mcp": {
      "type": "remote",
      "url": "http://127.0.0.1:38473/mcp",
      "oauth": false,
      "enabled": true
    }
  }
}
```

#### Antigravity

Antigravity (MCP Servers → Manage MCP Servers → View raw config):

```json
{
  "mcpServers": {
    "shadcn-studio-mcp": {
      "serverUrl": "http://127.0.0.1:38473/mcp"
    }
  }
}
```

These are configuration examples. Automated interoperability tests use the
official MCP TypeScript client; individual client applications and Pro API access
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
| `MCP_HTTP_HOST` | `127.0.0.1` | Bind IP address; `0.0.0.0` for all IPv4 interfaces, `::` for IPv6 |
| `MCP_HTTP_ALLOWED_HOSTS` | unset | Comma-separated request hostnames/IPs; required for non-loopback binding |
| `MCP_HTTP_PORT` | `38473` | Listening port |
| `MCP_HTTP_MAX_SESSIONS` | `64` | Maximum live sessions, including initialization |
| `MCP_HTTP_SESSION_TIMEOUT_MS` | `600000` | Idle session lifetime |
| `MCP_HTTP_MAX_IN_FLIGHT` | `64` | Maximum open HTTP requests, including GET streams |
| `MCP_HTTP_TOKEN` | unset | HTTP bearer token; required for non-loopback binding, optional on loopback |

Excess sessions/requests return 503; bodies are capped at 1 MiB. Each collection
holds at most 100 entries. Upstream HTTP requests have a 30-second deadline.
Resource use still grows with session objects and response sizes; it does not
multiply a full Node runtime per session.

The service defaults to loopback, checks Host and rejects browser Origin
headers. Non-loopback binding requires both a bearer token and an explicit host
allowlist. No CORS, built-in TLS, legacy SSE or OAuth service is provided.

When using a token, Codex can set `bearer_token_env_var = "MCP_HTTP_TOKEN"` in the
server entry (export that variable in the client environment as well). Other
clients can send `Authorization: Bearer <token>` using their `headers` setting.
The token is shared by this deployment, not a per-session account identity.

### Bind to another address or port

To change only the local port:

```bash
MCP_HTTP_PORT=38474 npm run start:http
```

To listen on all IPv4 interfaces, set the token and hostnames/IPs that clients
will actually use. Replace the example hostname/IP below with your own:

```bash
export MCP_HTTP_TOKEN="$(openssl rand -hex 32)"
MCP_HTTP_HOST=0.0.0.0 \
MCP_HTTP_PORT=38473 \
MCP_HTTP_ALLOWED_HOSTS=mcp.example.com,192.0.2.10 \
npm run start:http
```

Use `MCP_HTTP_HOST=::` for an IPv6 wildcard bind, or a specific interface IP to
limit listening to that interface. Hostnames are not accepted as bind addresses.
Clients must use the reachable server hostname/IP, **not** `0.0.0.0` or `::`, in
their URLs. All remote clients must send the configured bearer token.

`MCP_HTTP_ALLOWED_HOSTS` contains exact hostnames or IP addresses without schemes,
ports, paths or wildcards. Localhost/loopback request hosts remain accepted, but
token authentication still applies. A missing token/allowlist prevents external
startup; an unlisted Host or any browser Origin receives 403. Behind a proxy,
allow the Host it forwards; `X-Forwarded-Host` is not trusted.

Binding does not open a firewall or enable TLS. Restrict firewall access to your
clients and use HTTPS through a TLS reverse proxy or an SSH tunnel for traffic
over untrusted networks. For Docker bridge networking, bind to `0.0.0.0` inside
the container and publish the chosen port; the token and allowlist are still
required. HTTP mode never launches additional stdio servers.

### Run with systemd (Linux user service)

The repository includes [a user unit](deploy/shadcn-studio-mcp.service) and
[an environment-file template](deploy/server.env.example). Run the commands below
as the account that will own the service. These commands install the fork in
`~/.local/share/shadcn-mcp-server`; if that directory already exists, update the
existing checkout instead of cloning over it.

```bash
mkdir -p ~/.local/share
git clone --branch feat/streamable-http https://github.com/kkyubrother/shadcn-mcp-server.git ~/.local/share/shadcn-mcp-server
cd ~/.local/share/shadcn-mcp-server
npm ci
npm run build

install -d -m 700 ~/.config/shadcn-studio-mcp
install -d ~/.config/systemd/user
# First installation only: preserve your existing server.env on later updates.
install -m 600 deploy/server.env.example ~/.config/shadcn-studio-mcp/server.env
install -m 644 deploy/shadcn-studio-mcp.service ~/.config/systemd/user/shadcn-studio-mcp.service
```

Edit `~/.config/shadcn-studio-mcp/server.env` to choose the bind address, port,
allowlist, optional Pro credentials and HTTP token. For external binding, generate
a token with `openssl rand -hex 32` and paste it as the literal `MCP_HTTP_TOKEN`
value. An `EnvironmentFile` is not a shell script: do not use `export`, `$VAR` or
`$(...)` in it. Do not commit the populated file.

Check `command -v node`. The unit assumes `/usr/bin/node`; replace `ExecStart`'s
executable with the absolute path of your Node.js 20.3+ executable if different.
For nvm/asdf installations, systemd does not load your interactive shell setup.
If using another checkout directory, update both `WorkingDirectory` and the
`build/index.js` path in `ExecStart`.

```bash
systemctl --user daemon-reload
systemctl --user enable --now shadcn-studio-mcp.service
systemctl --user status shadcn-studio-mcp.service
journalctl --user -u shadcn-studio-mcp.service -n 50 --no-pager
```

The unit restarts the process on failure and sends SIGTERM on stop so sessions
can close. To keep the user service running after logout and start it at boot,
enable lingering for that account (this may require administrator privileges):

```bash
sudo loginctl enable-linger "$USER"
```

After changing `server.env` or rebuilding the checkout:

```bash
systemctl --user restart shadcn-studio-mcp.service
```

After editing the unit, run `systemctl --user daemon-reload` before restarting.
To stop the service and disable automatic startup:

```bash
systemctl --user disable --now shadcn-studio-mcp.service
```

Connect clients to the same `/mcp` URL as above, using the configured port and
server address. A user unit runs as your account and must not be installed under
`/etc/systemd/system` unchanged. See systemd's
[EnvironmentFile reference](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#EnvironmentFile=)
and [lingering reference](https://www.freedesktop.org/software/systemd/man/latest/loginctl.html#enable-linger%20USER%E2%80%A6).

### Development

```bash
npm run typecheck
npm test
```

Four integration tests cover the fork's core behavior: concurrent-session
isolation, session cleanup/capacity, external-access authentication and host
restrictions, and multiple clients without child processes. CI runs these on
Node.js 24; `npm test` also compiles TypeScript. Tests use local-only tools and
do not require credentials or call Shadcn Studio's API.

## Optional: stdio from this fork

After building this checkout, omit `--transport` (or set `--transport=stdio`):

```bash
node /absolute/path/to/shadcn-mcp-server/build/index.js
```

For example, Claude Code can start this checkout directly:

```bash
claude mcp add --transport stdio --scope user shadcn-studio-mcp -- \
  node /absolute/path/to/shadcn-mcp-server/build/index.js
```

Choose this instead of HTTP registration, not in addition to it. A stdio entry
starts a local server process according to the client's lifecycle; it does not
connect to the shared HTTP service. Pro credentials can be supplied through the
server environment or existing `API_KEY=...` and `EMAIL=...` arguments.

`npx -y shadcn-studio-mcp` installs the upstream npm release, **not this fork**.
The [upstream installation guide](https://shadcnstudio.com/mcp/onboarding) applies
to that release. Free features need no credentials; Pro features need both
`API_KEY` and `EMAIL`.

## 📒 Documentation

Shadcn Studio MCP Server is designed to be intuitive and easy to use. The commands are simple and straightforward, allowing you to create, inspire, refine, and convert Figma designs to UI blocks quickly.

For detailed documentation on how to use Shadcn Studio MCP Server, please refer to the [Shadcn Studio MCP Documentation](https://shadcnstudio.com/docs/getting-started/shadcn-studio-mcp-server).

## 🔧 Usage

The tools support four main workflows. The `/cui`, `/iui`, `/rui` and `/ftc`
shortcuts below require separate client command/skill setup; registering this MCP
server does not install them. Without shortcuts, ask your agent directly, for
example: "Use shadcn-studio-mcp to create a hero section for my SaaS landing page."
Figma-to-code additionally requires access to a Figma MCP server.

Workflow shortcuts (after configuring them):

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