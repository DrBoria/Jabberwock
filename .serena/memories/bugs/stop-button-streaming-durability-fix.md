# Stop Button / Streaming State Durability Fix

## Bug

After clicking "Stop" during tool-phase abort (agent asking for tool approval with no active API stream), the submit button would briefly revert to "send" mode but then get stuck in "Stop" mode. Root cause: `isStreaming` was reverting to `true` after subsequent state updates.

## Root Cause

Two distinct abort scenarios with different code paths:

1. **Stream-phase abort** (active API stream): `abortStream()` → `updateApiReqMsg(cancelReason)` on backend → `MESSAGES_UPDATED` intent with `api_req_started` + `cancelReason` → `handleStreamAbort()` in `task-received.ts` fires. This path was already correctly handled.

2. **Tool-phase abort** (no active stream, e.g. tool approval ask): Backend sets `isRunning: false` → syncs state → `mergeExtensionState()` → `finalizePartialOnCancel()`. NO `MESSAGES_UPDATED` arrives. The `api_req_started` notification has no `cancelReason` → `hasOrphanApiRequest()` returns `true` → `computeIsStreaming()` returns `true`.

## Fix Location

[`webview-ui/src/features/root-store/store.ts`](webview-ui/src/features/root-store/store.ts:35)

### Key Changes:

1. **Extracted `finalizeOrphanApiReqs()` helper** (line 35-55): Finds the last `api_req_started` notification in messages array. If it has no `cost` and no `cancelReason`, injects `cancelReason: "user_cancelled"` into the parsed JSON text.

2. **Removed `prev.isRunning === true` guard** from `finalizePartialOnCancel()`: Previously the function only ran on the `true→false` transition. Subsequent state updates with `isRunning: false` would skip it, allowing backend messages (without `cancelReason`) to overwrite the fix. Now runs on EVERY state update with `isRunning === false`.

### Files Modified:

- `webview-ui/src/features/root-store/store.ts` — Primary fix
- `webview-ui/src/features/chat/ask/utils.ts` — `hasOrphanApiRequest()` and `computeIsStreaming()` (secondary)
- `webview-ui/src/features/chat/task/events/handlers/task-received.ts` — `handleStreamAbort()` (stream-phase fix)

## Verification

All three layers verified via E2E:

1. **Backend**: Breakpoint on `finalizePartialOnCancel` confirmed execution on cancel
2. **Store**: `isStreaming` stays `false` after 10 second wait
3. **UI**: Button shows "Press Shift+Enter to send", not "Stop"
