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

For Pro features, set `SHADCN_STUDIO_API_KEY` and `SHADCN_STUDIO_EMAIL` in the
**server process environment**.
CLI `API_KEY=...` / `EMAIL=...` arguments remain supported. No Shadcn credential
is required in each client's MCP configuration. All sessions in this deployment
use the same Shadcn account; this is not a multi-tenant credential service.

### Server credentials

Set both values on the machine **running the server**, before starting it:

```bash
export SHADCN_STUDIO_API_KEY='your-shadcn-license-key'
export SHADCN_STUDIO_EMAIL='your-account-email'
npm run start:http
```

These exports apply to the current shell and processes started from it. Restart
an already-running server after changing them. HTTP clients only need the server
URL and, when enabled, `MCP_HTTP_TOKEN`; they do not need your Shadcn credentials.
`MCP_HTTP_TOKEN` protects access to this server and is separate from the Shadcn
license key used for outbound API requests.

For the systemd user service described below, put literal values in
`~/.config/shadcn-studio-mcp/server.env`:

```dotenv
SHADCN_STUDIO_API_KEY=your-shadcn-license-key
SHADCN_STUDIO_EMAIL=your-account-email
```

```bash
chmod 600 ~/.config/shadcn-studio-mcp/server.env
systemctl --user restart shadcn-studio-mcp.service
```

systemd loads this file through `EnvironmentFile`; exports in an interactive
terminal do not update the running service. The application does not automatically
load a `.env` file. Keep the populated environment file outside the repository.

If migrating an existing deployment, rename environment variables `API_KEY` and
`EMAIL` to `SHADCN_STUDIO_API_KEY` and `SHADCN_STUDIO_EMAIL`; the generic environment
names are no longer read. Legacy CLI arguments `API_KEY=...` / `EMAIL=...` are
still accepted and override the environment values. Omit both credentials for
free features; Pro features require both.

### Client configuration (including remote-server tokens)

Start the server before connecting. The examples below connect to a server at
`http://192.168.9.29:38473/mcp`; replace the address with your server's reachable
IP/hostname. For a server on the same computer, use `http://127.0.0.1:38473/mcp`.
If you changed `MCP_HTTP_PORT`, change the client URL too.

**Every client must send the same token configured as `MCP_HTTP_TOKEN` on the
server**, using `Authorization: Bearer <token>`. Replace `YOUR_MCP_HTTP_TOKEN` in
the examples with that token, not your Shadcn license key. Setting the token only
on the server does not configure the clients. `SHADCN_STUDIO_API_KEY` and
`SHADCN_STUDIO_EMAIL` remain on the server and are not needed in client settings.

For example, the remote server's environment file contains:

```dotenv
MCP_HTTP_HOST=0.0.0.0
MCP_HTTP_PORT=38473
MCP_HTTP_ALLOWED_HOSTS=192.168.9.29
MCP_HTTP_TOKEN=YOUR_MCP_HTTP_TOKEN
```

Use one client configuration below. Replace existing stdio or unauthenticated
entries rather than adding a second copy under another name. The default port
`38473` is not reserved; choose another port if it is already in use.

#### Claude Code

Set the token in the terminal where you register the connection:

```bash
export MCP_HTTP_TOKEN='YOUR_MCP_HTTP_TOKEN'
claude mcp add \
  --header "Authorization: Bearer ${MCP_HTTP_TOKEN:?Set the server token first}" \
  --transport http --scope user \
  shadcn-studio-mcp http://192.168.9.29:38473/mcp
```

If the same name already exists in user scope, remove that entry first and then
run the registration command above:

```bash
claude mcp remove --scope user shadcn-studio-mcp
```

If the existing entry is project- or local-scoped, update that scope instead;
a higher-priority entry can override the user-scoped entry. Use `--scope project`
instead of `--scope user` to save configuration in the project's `.mcp.json`.

The shell expands the token at registration time, so Claude Code stores the token
value in its MCP configuration. When rotating the server token, update the client
entry too. Check the connection and tools with `/mcp` inside Claude Code. There is
no OAuth login for this server. See the [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp).

#### Codex

Export the token in the environment that **launches Codex**:

```bash
export MCP_HTTP_TOKEN='YOUR_MCP_HTTP_TOKEN'
codex
```

In `~/.codex/config.toml`:

```toml
[mcp_servers.shadcn-studio-mcp]
url = "http://192.168.9.29:38473/mcp"
bearer_token_env_var = "MCP_HTTP_TOKEN"
```

`bearer_token_env_var` contains the variable's **name**, not the token. An already
running desktop app does not inherit an export made in another terminal. If the
app launcher cannot provide this environment variable, use an explicit header
instead of `bearer_token_env_var`:

```toml
[mcp_servers.shadcn-studio-mcp]
url = "http://192.168.9.29:38473/mcp"
http_headers = { Authorization = "Bearer YOUR_MCP_HTTP_TOKEN" }
```

Choose one of these two entries, not both. The header alternative stores the token
in the configuration file. Restart/reconnect the client after changing settings.

#### OpenCode

In `~/.config/opencode/opencode.json`, merge this server into existing settings:

```json
{
  "mcp": {
    "shadcn-studio-mcp": {
      "type": "remote",
      "url": "http://192.168.9.29:38473/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_HTTP_TOKEN"
      },
      "oauth": false,
      "enabled": true
    }
  }
}
```

Replace the token placeholder with the server token. `oauth: false` keeps this
connection on static bearer authentication rather than OAuth discovery.

#### Antigravity

Open MCP Servers → Manage MCP Servers → View raw config and merge this entry:

```json
{
  "mcpServers": {
    "shadcn-studio-mcp": {
      "serverUrl": "http://192.168.9.29:38473/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_HTTP_TOKEN"
      }
    }
  }
}
```

Replace the token placeholder with the server token and reconnect the server.
OpenCode and Antigravity examples above store the token in their configuration
files; do not commit populated configurations to a shared repository.

#### Connection checks

- **401 Unauthorized:** the client omitted the bearer token or used a different one.
- **403 Host or Origin not allowed:** include the URL's hostname/IP in the server's
  `MCP_HTTP_ALLOWED_HOSTS`; browser Origin requests are not supported.
- **Connection refused:** check that the service is running, the port is correct,
  and the bind address is reachable. This occurs before token validation.

For local-only operation with no server-side `MCP_HTTP_TOKEN`, omit the client
Authorization header or `bearer_token_env_var`. External binding requires a token.
Use HTTPS or an SSH tunnel for connections across untrusted networks; the example
HTTP endpoint itself does not encrypt the token.

These are configuration examples. Automated interoperability tests use the
official MCP TypeScript client; individual client applications need separate
acceptance testing.

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

### Troubleshooting: `Failed to connect to bus: No such file or directory`

If `systemctl --user daemon-reload` prints this error, it cannot reach the
account's user service manager/bus. This is not an MCP server error. It can occur
in root, `su` or minimal/container sessions without a working user service bus;
running as root does not itself guarantee that `systemctl --user` will work.

Check the init process and Node executable:

```bash
ps -p 1 -o comm=
command -v node
```

If PID 1 is not `systemd`, these systemd instructions do not apply. Use the
container's foreground command (`node build/index.js --transport=streamable-http`)
or its process supervisor instead. If PID 1 is `systemd`, a root installation can
use a **system service**, without `--user`, as shown below.

#### Alternative: system service for an existing root installation

Run the following in a root shell. This example runs the service as root and
assumes the checkout is `/root/.local/share/shadcn-mcp-server` and the populated
environment file is `/root/.config/shadcn-studio-mcp/server.env`. Build the checkout
first (`npm ci && npm run build`) and create/edit the environment file using the
settings described above. Preserve an existing environment file when updating.
For an installation owned by another account, use that account's paths and set
`User=` in the unit accordingly.

Confirm the required files and executable exist before registering:

```bash
test -f /root/.local/share/shadcn-mcp-server/build/index.js
test -f /root/.config/shadcn-studio-mcp/server.env
command -v node
```

If either file check fails, finish the build or environment-file setup first.
Then create the system unit (this replaces a unit with the same name):

```bash
MCP_NODE_BIN="$(command -v node)"

cat > /etc/systemd/system/shadcn-studio-mcp.service <<EOF
[Unit]
Description=Shadcn Studio MCP Server
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/.local/share/shadcn-mcp-server
ExecStart=${MCP_NODE_BIN} /root/.local/share/shadcn-mcp-server/build/index.js --transport=streamable-http
EnvironmentFile=/root/.config/shadcn-studio-mcp/server.env
Restart=on-failure
RestartSec=5
TimeoutStopSec=40
KillMode=control-group
UMask=0077
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

chmod 600 /root/.config/shadcn-studio-mcp/server.env
systemctl daemon-reload
systemctl enable --now shadcn-studio-mcp.service
systemctl status shadcn-studio-mcp.service
journalctl -u shadcn-studio-mcp.service -n 50 --no-pager
```

The shell writes the resolved Node path into `ExecStart`; update it if you later
remove or change that Node installation. Choose either the user service or the
system service, not both on the same port. If a user service was previously
started, stop and disable it through that account's working user manager first.
The system service does not require `loginctl enable-linger`.

After changing credentials or rebuilding, use:

```bash
systemctl restart shadcn-studio-mcp.service
```

After changing the system unit, run `systemctl daemon-reload` before restarting.
To stop it and disable startup, use `systemctl disable --now shadcn-studio-mcp.service`.
All commands for this alternative omit `--user`; the `MCP_HTTP_*` binding and
authentication settings are otherwise unchanged.

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
`SHADCN_STUDIO_API_KEY` and `SHADCN_STUDIO_EMAIL`.

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