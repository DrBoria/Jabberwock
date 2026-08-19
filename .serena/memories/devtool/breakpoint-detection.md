# BREAKPOINT_ACTIVE Detection Architecture

## Three-tier detection system

### Tier 1: HTTP Polling (pollExtensionStatus)

- File: `packages/devtool/src/api/mcp-entry/mcp-entry.ts:90`
- Two-phase: Fast poll (8×200ms) + Long retry (3×1s) if port was open but HTTP timeout
- TCP socket check (isPortOpen) definitively distinguishes "not running" from "breakpoint"
- Only used when WebSocket is NOT connected (fast-path in ensureConnection)

### Tier 2: Guard Timer (proxyToolCall)

- File: `packages/devtool/src/api/mcp-entry/mcp-entry.ts:210`
- 10s timer covering ONLY the ensureConnection phase
- Explicitly NOT covering client.callTool() — removed to fix false positives during generation
- During generation, webview-bound tools (find_element, etc.) can take >10s without being at breakpoint

### Tier 3: Timeout-forced poll (this fix)

- File: `packages/devtool/src/api/mcp-entry/mcp-entry.ts:248-256`
- When client.callTool() times out (30s) while WebSocket is still connected:
    1. Force-disconnect client
    2. ensureConnection() does full HTTP poll → detects breakpoint
    3. Returns clear BREAKPOINT_ACTIVE error
- Fixes the case where breakpoint hits AFTER WebSocket is already connected

## Key insight

RawWsTransport.isConnected stays true even when extension is frozen at breakpoint (process is still running, just paused — onclose never fires). This caused ensureConnection() to fast-path during retry. The fix forces disconnect on timeout-like errors to re-enable full HTTP polling.
