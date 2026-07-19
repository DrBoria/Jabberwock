# Architectural Analysis: Abort Flow — Why Fixing One Bug Creates Another

## Executive Summary

The infinite message loop bug and the subsequent regression (messages not sending after Stop) are symptoms of the same root architectural problem: **`store.chat.abort` conflates two semantically distinct concerns — "stop the current processing" and "prevent new processing" — into a single flag with conflicting lifecycle requirements.**

---

## 1. Architecture Document vs Current Implementation

### What the Architecture Says

The [`plans/architectural-restructure-v2.md`](plans/architectural-restructure-v2.md) specifies:

1. **Two IntentBuses, One EventBridge**: Frontend and backend each have their own IntentBus. Intents NEVER cross EventBridge. Only Events cross.
2. **ALL state in MST**: Zero module-level mutable state.
3. **Handler → Intent → Event action creator → EventBridge**: Handlers never create Events directly.
4. **Sequential dispatch**: IntentBus processes intents one at a time in FIFO order via `processQueue`.

### Where the Architecture Fails

**The architecture does NOT address the IntentBus blocking problem.** The Stop button pattern requires:

1. A cancel intent to be processed by IntentBus
2. But IntentBus is blocked processing the current `UserMessageReceived` handler (which awaits `handleStream`, MCP tool calls, etc.)
3. The cancel intent sits in the processing queue indefinitely

This is a fundamental architectural gap. The architecture assumes all intents can be dispatched sequentially without race conditions, but the cancel/abort pattern inherently requires **breaking into the current processing**.

### What the Current Code Actually Does (After Fix)

The Stop handler in [`register-on-task-intents.ts`](src/features/chat/task/events/handlers/register-on-task-intents.ts:62-75) bypasses the IntentBus entirely:

```typescript
// Direct synchronous mutations — bypasses IntentBus
store.chat.setAbort(true)
store.chat.setIsRunning(false)
activeTask?.abortTask?.()
store.chat.tasks.get(taskId)?.cancelCurrentRequest?.()

// Also creates intent (secondary, may never be processed)
store.intentStore.createIntent({ type: "task.cancel.requested", ... })
```

This is a **pragmatic workaround** for the architectural gap but introduces a new problem (see below).

---

## 2. The Dual-Purpose Bug: `store.chat.abort`

### The Two Concerns

The `store.chat.abort` flag (defined in [`chatStore.actions.ts`](src/features/chat/actions/chatStore.actions.ts:38)) serves TWO distinct purposes:

| Concern            | Set by                                                  | Checked by                                                                                                                                           | Lifecycle                                                                    |
| ------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **A: Stop signal** | Stop handler sets `abort=true` synchronously            | Abort branch in [`on-message-received.ts:105`](src/features/chat/task/messages/handlers/user/on-message-received.ts) checks `taskModel._state.abort` | **Transient** — should reset when handler acknowledges the abort             |
| **B: Lock signal** | Stop handler sets `store.chat.abort=true` synchronously | Guard check at [`on-message-received.ts:84`](src/features/chat/task/messages/handlers/user/on-message-received.ts)                                   | **Persistent** — should stay true until user explicitly initiates new action |

**The conflict**: These concerns have OPPOSITE lifecycle requirements. Concern A should auto-reset; Concern B should persist until manual reset. But they share the same flag.

### The Bug Flow (Original, Before Any Fix)

```
User sends "hi"
  → UserMessageReceived handler starts (guard passes: abort=false, isProcessing=false)
  → handleStream → result
  → executeTools → waitForToolExecutionAndPrepareNextContent
      │
User clicks Stop ──────────────────────────────────────────┐
  → CHAT_TASK_CANCEL_TASK handler (OLD)                    │
    → creates task.cancel.requested intent                 │
    → [does NOT set store.chat.abort]                      │
    → [does NOT call abortTask()]                          │
    → [does NOT set isRunning=false]                       │
      │                                                    │
      ▼                                                    │
  IntentBus: isProcessing=true → cancel intent             │
  sits in queue (NEVER dispatched because                  │
  current handler hasn't returned)                         │
                                                           │
  waitForToolExecutionAndPrepareNextContent ───────────────┘
  returns nextUserContent
  → executeTools creates new UserMessageReceived intent
  → setImmediate yield
  → IntentBus dispatches NEW UserMessageReceived (cancel still queued behind)
  → Guard check: abort=false, isProcessing=false → PASSES!
  → LOOP CONTINUES indefinitely
```

**Root cause**: The original `CHAT_TASK_CANCEL_TASK` handler was PURELY ASYNC (only created an intent). Since the IntentBus was blocked, the cancel intent was never dispatched.

### The Fix and the Regression

**Fix applied**: The synchronous handler now directly sets `store.chat.setAbort(true)` and `abortTask()`. The `UserMessageReceived` handler now has an abort branch that catches `taskModel._state.abort` and returns early **without** calling `executeTools`, so no new intents are created.

**Regression**: `store.chat.abort` is never reset. When the user sends a new message after Stop:

```
User sends new message after Stop
  → Frontend posts CHAT.TASK.NEW_TASK
  → Backend creates new task via createTask → startTask
  → startTask creates UserMessageReceived intent
  → Guard check: store.chat.abort === true → REJECTS!
  → Chat stays empty — nothing appears
```

The `startTask` function ([`start-task.ts:41`](src/features/chat/task/actions/startTask/start-task.ts)) creates a `UserMessageReceived` intent for the new message, but the guard check at [`on-message-received.ts:84`](src/features/chat/task/messages/handlers/user/on-message-received.ts) blocks it because `store.chat.abort` is still `true` from the previous Stop.

---

## 3. Why the Original `setAbort(false)` Was Wrong but Necessary

The original abort branch in `on-message-received.ts` had:

```typescript
if (taskModel._state.abort) {
	taskModel.setIsProcessing(false)
	store.chat.setAbort(false) // ← This was the bug
	return
}
```

**Why it was a bug**: When the abort branch ran BEFORE the `task.cancel.requested` intent was processed, `setAbort(false)` reset the guard. If `executeTools` had already created new `UserMessageReceived` intents (or if the tool loop produced them in a subsequent `processQueue` cycle), they would pass the guard and continue the loop.

**Why it was necessary**: Without it, `store.chat.abort` stays `true` forever and no new messages can ever be processed.

**The tension**: The abort branch needs to reset the flag so new messages work, but it shouldn't reset it if there are queued `UserMessageReceived` intents from the tool loop that would bypass the guard.

---

## 4. The Correct Fix: Two-Part Solution

### Part A: Reset `store.chat.abort` in the Abort Branch (Now Safe)

In [`on-message-received.ts:105-122`](src/features/chat/task/messages/handlers/user/on-message-received.ts), the abort branch should reset `store.chat.setAbort(false)`.

**Why this is safe now** (unlike before):

1. The synchronous Stop handler (`register-on-task-intents.ts:62-75`) already performed ALL cancel operations directly:

    - `store.chat.setAbort(true)` — store-level flag set
    - `activeTask?.abortTask?.()` — task-level `_state.abort = true`
    - `cancelCurrentRequest?.()` — `abortController.abort()`
    - `store.chat.setIsRunning(false)`

2. The abort branch runs **before** `finalizeToolCalls` and `executeTools` ([`on-message-received.ts:124-126`](src/features/chat/task/messages/handlers/user/on-message-received.ts)) — no new `UserMessageReceived` intents were created.

3. The `task.cancel.requested` intent in the queue will be processed by IntentBus after the current handler returns, but it's now redundant — the synchronous handler already did everything.

4. **No queued `UserMessageReceived` intents** from the tool loop because `executeTools` was never called.

### Part B: Safety Net in `startTask`

In [`start-task.ts:41`](src/features/chat/task/actions/startTask/start-task.ts), reset `store.chat.setAbort(false)` and `store.chat.setAbortReason(undefined)` before creating the `UserMessageReceived` intent.

This ensures that even if the abort branch somehow missed the reset (e.g., the race condition where `handleStream` finishes before the synchronous handler fires), the new task flow explicitly opens the guard.

### Protection Against the Race Condition

There's a race condition where `handleStream` completes before the synchronous Stop handler fires:

```
handleStream finishes → result returned
  → Abort check: taskModel._state.abort === false (synchronous handler hasn't fired yet)
  → Abort branch SKIPPED
  → finalizeToolCalls runs
  → executeTools runs → creates new UserMessageReceived intents
  → [synchronous handler fires NOW → setAbort(true)]
  → New UserMessageReceived intent guard check: store.chat.abort === true → REJECTS ✓
```

This is handled correctly even without Part A, because `store.chat.abort` is set synchronously by the Stop handler and the guard check catches it.

---

## 5. Deeper Architectural Issues

### 5.1 Synchronous Bypass of IntentBus

The current fix uses synchronous state mutations to work around the IntentBus blocking problem. This violates the architecture's core principle:

> **Handler never creates an Event directly. Handler creates an Intent, intent handler creates an Event.**

The synchronous handler in `register-on-task-intents.ts` directly mutates `store.chat`, `activeTask`, and calls `cancelCurrentRequest`. This is a pragmatic but non-architectural solution.

**Long-term fix**: The architecture needs to account for the cancel pattern. One approach: add a **priority queue** to IntentBus that allows urgent intents (like cancel) to preempt the current handler.

### 5.2 Dual-Purpose Signal

The `store.chat.abort` flag should be split into two separate concepts:

```typescript
// In chatStore.actions.ts
abort: false,           // Current: used for both stop + lock
// Should become:
abort: false,           // Lock signal — blocks new processing
abortAcknowledged: false, // Transient — set true when current handler exits abort branch
```

But a simpler approach that doesn't require store changes: **the abort branch resets the flag as the final act before returning** (Part A above), and `startTask` resets it as a safety net (Part B above).

### 5.3 Message Initialization Flow

The current flow where a new message creates a `UserMessageReceived` intent through `startTask` is architecturally correct. The problem was only that `store.chat.abort` blocked it. Once the abort flag is properly managed, this flow works as designed.

---

## 6. Files to Modify

### 6.1 Backend Changes (2 files)

| File                                                                                                                                           | Change                                                                                                                     | Rationale                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [`src/features/chat/task/messages/handlers/user/on-message-received.ts`](src/features/chat/task/messages/handlers/user/on-message-received.ts) | Add `store.chat.setAbort(false)` + `store.chat.setAbortReason(undefined)` in the abort branch before `return`              | Reset the guard flag after acknowledging the abort — safe because `executeTools` was never called |
| [`src/features/chat/task/actions/startTask/start-task.ts`](src/features/chat/task/actions/startTask/start-task.ts)                             | Add `store.chat.setAbort(false)` + `store.chat.setAbortReason(undefined)` before creating the `UserMessageReceived` intent | Safety net — ensures new task processing is never blocked by stale abort state                    |

### 6.2 No Frontend Changes Needed

The frontend changes (which were correct but now need the backend abort reset to take effect):

- `handleStreamAbort` in [`task-received.ts`](webview-ui/src/features/chat/task/events/handlers/task-received.ts) — correctly resets streaming state
- `handleSayMessage` in [`handlers.ts`](webview-ui/src/features/chat/ask/handlers.ts) — correctly skips `setSendingDisabled(true)` for cancelled API requests
- `finalizePartialOnCancel` in [`store.ts`](webview-ui/src/features/root-store/store.ts) — correctly finalizes partial messages on cancel

These changes will work correctly once the backend properly resets `store.chat.abort`.

---

## 7. Verification Plan

1. **Apply Part A**: Add `store.chat.setAbort(false)` and `store.chat.setAbortReason(undefined)` in the abort branch
2. **Apply Part B**: Add `store.chat.setAbort(false)` and `store.chat.setAbortReason(undefined)` in `startTask`
3. `pnpm build --force`
4. **Restart debugger**
5. **Verify the original bug is still fixed**: Send "hi" → Stop → confirm 0 new tool call attempts and UI recovers
6. **Verify the regression is fixed**: After Stop → send "hi" again → confirm message appears in chat and generation starts
7. **Verify new chat works**: New chat → send message → confirm chat works normally
8. **Verify Stop-then-new-chat works**: Send message → Stop → New Chat → send message → confirm works
9. `pnpm check-all` before completion
