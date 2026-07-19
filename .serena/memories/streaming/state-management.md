# Streaming State Management

## Two Separate Stores

### 1. Backend: `StreamingStoreModel` (MST)

- **File**: `src/features/api/streamingstore/store.ts`
- Per-task MST model tracking `isStreaming`, `isWaitingForFirstChunk`, `didCompleteReadingStream`, etc.
- Manages streaming lifecycle state for the backend task loop.

### 2. Webview: `StreamingStore` (Non-MST reactive singleton)

- **File**: `webview-ui/src/features/api/streaming/store.ts`
- Exception to the "no state outside MST" rule — receives 1000+ updates/sec during streaming.
- Properties: `taskId`, `text`, `isActive`, `error`.

## How `isActive` is Set

### Started

- **When**: Backend sends a `streamChunk` postMessage.
- **Handler**: `handleStreamChunk` in `webview-ui/src/features/root-store/helpers.ts:35`
- **Logic**: If `!streamingStore.getSnapshot().isActive`, call `streamingStore.start(taskId)`, then `streamingStore.appendChunk(text)`.

### Stopped

- **When**: Backend sends a finalized (non-partial) `MESSAGES_UPDATED` intent.
- **Handler**: `registerOnFrontendTaskIntents` → `MESSAGES_UPDATED` handler in `webview-ui/src/features/chat/task/events/handlers/task-received.ts:62`
- **Logic**: If `msg && !msg.partial`, call `streamingStore.end("")`.

### Backend Dispatch

1. `executeApiStream()` in `src/features/api/handlers/stream/streamExecutor/streamExecutor.ts:18`:
    - Calls `dispatchStreamingStarted()` → creates a `STREAMING_STARTED` intent
    - Calls `dispatchStreamingEnded()` → creates a `STREAMING_ENDED` intent after processing
2. `runStreamLoop()` in `src/features/api/handlers/stream/streamRunner.ts:89`:
    - For each `text` chunk: calls `sendStreamChunk({ taskId, text })` which sends raw `streamChunk` postMessage directly to webview (bypassing IntentBus).

### Webview Consumption

- **Hook**: `useStreamingStore()` in `webview-ui/src/features/api/streaming/hooks/useStreamingStore.ts:14`
- Subscribes to `StreamingStore` and returns current `Readonly<StreamingState>`.
- Used by `StreamingFooter` component to display live streaming text.

## MST-level `isStreaming` in ChatStore

- **File**: `webview-ui/src/features/chat/store.tsx`
- `ChatStore.isStreaming` is set via `computeAskDerivedState()` → `computeIsStreaming()`.
- `computeIsStreaming()` logic (`webview-ui/src/features/chat/task/notifications/ask/utils.ts:25`):
    - Returns `false` if no current task item
    - Returns `true` if there's an orphan API request (no cost yet)
    - Returns `false` if a tool is currently asking (buttons enabled + non-empty text, or `interactive_app`)
    - Returns `true` if last message has `partial === true`

## Key Architecture Points

- `streamChunk` is the **only message type** that bypasses EventConstants/IntentBus — sent via direct `postMessage()`.
- `streamingStore.end("")` is triggered by `MESSAGES_UPDATED` handler when the message is non-partial (finalized).
- The two `isStreaming`/`isActive` flags are separate:
    - `StreamingStore.isActive` — raw text streaming (per-chunk updates)
    - `ChatStore.isStreaming` — computed from message state (for UI logic like showing/hiding ask buttons)
