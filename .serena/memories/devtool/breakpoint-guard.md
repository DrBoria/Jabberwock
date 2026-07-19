# Breakpoint Guard Implementation (Final)

## Problem

When the Extension Dev Host is paused at a breakpoint during debugging, ALL devtool MCP requests (DOM queries, store queries, console queries) hung for 10-30s per request, accumulating up to 300s of waiting. This happens because:

- The extension host's JS event loop is PAUSED at the breakpoint
- WebSocket messages from the MCP entry process are buffered at the OS level but never processed
- The DevtoolClient has a 30s internal timeout, causing each request to wait 30s before failing
- The retry logic adds another 30s per attempt

## Architecture Change: Stdio MCP Proxy

Replaced direct WebSocket MCP connection with a stdio-based proxy (`mcp-entry.ts`):

1. **`.roo/mcp.json`** — Changed from `"type": "websocket"` to command-based:
    ```json
    "jabberwock-devtools": {
      "command": "npx",
      "args": ["--no-install", "tsx", "packages/devtool/src/api/mcp-entry/mcp-entry.ts"],
      ...
    }
    ```
2. **No `"type"` field** — command MCP servers in Roo must NOT have `"type"`, only `"command"` + `"args"`
3. **Lazy connect on demand** — No persistent connection state. On every `proxyToolCall()`, `ensureConnection()` is called fresh: polls extension status, connects WebSocket only when extension is available

## Two-Process Architecture

- **MCP Entry Process** (`packages/devtool/src/api/mcp-entry/mcp-entry.ts`) — SEPARATE child process spawned by Roo via `npx tsx`. Event loop NOT paused during breakpoints. Receives stdio MCP messages and proxies them via WebSocket to the extension host.
- **Extension Host Process** — Contains WsMcpServer + wrapBridge. Event loop IS paused during breakpoints.

## Three-Mode Detection in `pollExtensionStatus()`

Uses a two-step detection with raw TCP socket + HTTP fetch:

1. **Raw TCP socket** (`isPortOpen()`) via `net.connect()` — definitively determines if port 60061 is open/closed
2. **HTTP fetch** with `AbortSignal.timeout(200ms)` — when port is open, distinguishes running from breakpoint

Results:
| Extension State | TCP Check | HTTP Fetch | Result | Time |
|----------------|-----------|------------|--------|------|
| NOT RUNNING | Port closed | — | `DISCONNECTED` | <1s |
| BREAKPOINT | Port open | Times out | `BREAKPOINT_ACTIVE` | ~3-4s |
| RUNNING | Port open | 200 OK | tool data | ~1s |

## Error Messages

- `DISCONNECTED: Extension is not running. Launch the extension and retry.`
- `BREAKPOINT_ACTIVE: Extension host is paused at a breakpoint. Release the breakpoint and retry.`

## Key Files

- `packages/devtool/src/api/mcp-entry/mcp-entry.ts` — The proxy entrypoint (all logic)
- `packages/devtool/src/api/mcp-entry/schemas.ts` — Tool registration (10 extra tools added)

## Why TCP socket check instead of fetch error inspection

On Node.js, `fetch()` with `AbortSignal.timeout()` wraps underlying errors inconsistently. Connection refused (`ECONNREFUSED`) is nested in `err.cause`, but the 200ms `AbortSignal.timeout` may trigger before the error propagates. Raw `net.connect()` gives a definitive answer regardless of fetch's error handling.

## Auto-Reconnect Behavior

- No cached `connected` state — every tool call retries connection
- Guard timer (6s) races against `ensureConnection()` + `client.callTool()`
- On DISCONNECTED or BREAKPOINT_ACTIVE errors, rethrows immediately
- On other errors, reconnects and retries once
