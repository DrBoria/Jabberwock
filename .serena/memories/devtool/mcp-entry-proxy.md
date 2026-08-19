# MCP Entry Proxy Architecture

## What Changed

Replaced direct WebSocket MCP connection with stdio-based proxy for Jabberwock Devtool tools.

## Before

`.roo/mcp.json` used `"type": "websocket"` with `"url": "ws://127.0.0.1:60060/ws"` — required manual devtool connection by the user.

## After

`.roo/mcp.json` uses command-based config:

```json
"jabberwock-devtools": {
  "command": "npx",
  "args": ["--no-install", "tsx", "packages/devtool/src/api/mcp-entry/mcp-entry.ts"],
  ...
}
```

Must NOT have `"type"` field — command MCP servers in Roo use only `"command"` + `"args"`.

## How It Works

1. Roo spawns `npx tsx packages/devtool/src/api/mcp-entry/mcp-entry.ts` as a child process
2. The process implements a stdio MCP server (receives tool calls via stdin, responds via stdout)
3. On each tool call, `pollExtensionStatus()` checks if extension host is running:
    - TCP socket check on port 60061 (raw `net.connect()`)
    - If port open → HTTP fetch `/status` on port 60061
    - Distinguishes: NOT_RUNNING, BREAKPOINT_ACTIVE, or RUNNING
4. If running → connects WebSocket to extension host via `DevtoolClient`, proxies the call
5. If not running/frozen → returns clear error, no connection attempt

## Key Features

- **Lazy connect on demand**: no persistent connection, fresh poll on every tool call
- **Auto-reconnect**: no cached state, always retries
- **Breakpoint guard**: returns BREAKPOINT_ACTIVE in ~3-4s instead of 60s timeout
- **Disconnected detection**: returns DISCONNECTED in <1s when extension not running
- **All tools always available**: tool listing doesn't depend on extension connection

## Files

- `packages/devtool/src/api/mcp-entry/mcp-entry.ts` — Main proxy logic
- `packages/devtool/src/api/mcp-entry/schemas.ts` — Tool registration (10 extra tools added)
- `.roo/mcp.json` — VS Code MCP config (command-based, no "type" field)
