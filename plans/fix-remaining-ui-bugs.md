# Plan: Fix 2 Remaining UI Bugs

## Bug 3: Approve/Deny Buttons Disabled When Tool Call Is Pending

### Reproduction Steps

1. Open chat with any agent mode (e.g., Coder)
2. Send a message that triggers a tool call (e.g., "read the current file")
3. Wait for the agent to process and produce a tool call
4. **Expected**: Approve + Deny buttons appear at the bottom, enabled, waiting for user decision
5. **Actual**: Buttons appear but are **disabled** (greyed out, `opacity-50`), user cannot click them

### Technical Analysis

#### Button Rendering Chain

1. **`AskResponder`** at [`webview-ui/src/features/chat/task/messages/components/responders/ask-responder.tsx:85-86`](../webview-ui/src/features/chat/task/messages/components/responders/ask-responder.tsx:85) renders buttons with `disabled={!enableButtons}`
2. Reads `enableButtons` from `ChatStore` (MobX-State-Tree) via `useChatUI()`
3. If `enableButtons` is `false`, buttons are disabled and container gets `opacity-50`

#### State Update Flow (processAskMessage)

Located at [`webview-ui/src/features/chat/ask/store.ts:24-34`](../webview-ui/src/features/chat/ask/store.ts:24):

1. If `lastMessage.type === "ask"`:
    - `processSimpleAsk(ui, lastMessage, isPartial, t)` — handles common ask types
    - If it returns `undefined` (type not found): `processComplexAsk(ui, lastMessage, isPartial, ...)` — handles complex types
2. After either path: `computeAskDerivedState(ui, messages, ...)` — sets metrics, streaming state

#### processSimpleAsk behavior for "tool"

[`webview-ui/src/features/chat/ask/orchestrators.ts:19-49`](../webview-ui/src/features/chat/ask/orchestrators.ts:19):

- `"tool"` is NOT in the switch cases
- Falls through to `default` which calls:
    ```typescript
    ui.setEnableButtons(true) // enable buttons!
    ```
    Returns `undefined`

#### processComplexAsk behavior for "tool"

[`webview-ui/src/features/chat/ask/orchestrators.ts:51-70`](../webview-ui/src/features/chat/ask/orchestrators.ts:61):

- `"tool"` IS matched → calls `handleToolAsk(ui, isPartial, lastMessage, t)`

#### handleToolAsk

[`webview-ui/src/features/chat/ask/handlers.ts:37-56`](../webview-ui/src/features/chat/ask/handlers.ts:44):

```typescript
ui.setEnableButtons(!isPartial) // disabled if isPartial === true
```

The `isPartial` comes from `lastMessage.partial === true` (line 25 of store.ts).

#### The Critical Sequence

1. `processSimpleAsk` default: `enableButtons(true)`
2. `processComplexAsk` → `handleToolAsk`: `enableButtons(!isPartial)`
3. If `isPartial === true`: step 2 OVERRIDES step 1 → buttons become **disabled**
4. If `isPartial === false`: step 2 sets `enableButtons(true)` → buttons **enabled**

#### What can cause `isPartial === true` for a tool ask?

The backend sets `partial = false` on content blocks in:

- [`src/features/api/handlers/helpers/process/toolCallHandlers.ts:107`](../src/features/api/handlers/helpers/process/toolCallHandlers.ts:107) — sets `existingToolUse.partial = false`
- [`src/features/api/handlers/helpers/recover/requestAbortManager.ts:61`](../src/features/api/handlers/helpers/recover/requestAbortManager.ts:61) — sets `lastMessage.partial = false` on abort

**But**: these set `partial = false` on the assistant message content blocks (tool_use type), NOT on the **ask notification** itself. The ask notification (`type: "ask", ask: "tool"`) has its own `partial` field that might be managed separately.

#### What also clears buttons

- **`handleSayMessage`** for `api_req_started`: [`webview-ui/src/features/chat/ask/handlers.ts:157-163`](../webview-ui/src/features/chat/ask/handlers.ts:157):

    ```typescript
    ui.setCurrentAsk("")
    ui.setEnableButtons(false)
    ui.setPrimaryButtonText("")
    ui.setSecondaryButtonText("")
    ```

    This fires when `api_req_started` is the LAST message.

- **`clearAskUI`**: [`webview-ui/src/features/chat/ask/handlers.ts:165-170`](../webview-ui/src/features/chat/ask/handlers.ts:165) — called when `lastMessage.type === "ask" && lastMessage.isAnswered`.

- **`resetAskState`**: [`webview-ui/src/features/chat/ask/store.ts:117-123`](../webview-ui/src/features/chat/ask/store.ts:117) — called when task is reset.

#### Root Cause Hypotheses (ordered by likelihood)

##### H1 (HIGH): Tool ask notification's `partial` field never flips to `false`

The backend creates the tool ask notification with `partial: true` during streaming. When the tool call stream completes, the content blocks get `partial = false`, but the ask notification itself might not get the same treatment. If the ask notification's `partial` stays `true`, `handleToolAsk` will always disable buttons.

##### H2 (MEDIUM): Message re-ordering — `api_req_started` (say type) arrives AFTER the tool ask

If the last message in the array is `api_req_started` (say type) instead of the tool ask (ask type), `handleSayMessage` fires and clears all button state. This would happen if the agent processes multiple tool calls sequentially.

##### H3 (LOW): `computeAskDerivedState` → `computeIsStreaming` incorrectly returns `true`

[`webview-ui/src/features/chat/ask/utils.ts:24-35`](../webview-ui/src/features/chat/ask/utils.ts:24):

```typescript
return modifiedMessages.at(-1)?.partial === true // if true → isStreaming
```

If streaming is `true`, the UI might show a "waiting" state instead of "user input needed".

### Fix Approach

1. **Add logging** in `processAskMessage` to trace `isPartial`, `enableButtons`, and `currentAsk` values
2. **Check** if the tool ask notification's `partial` flag is properly managed on the backend
3. **Fix**: If H1 confirmed, ensure the ask notification's `partial` is set to `false` when the tool call stream completes (similar to how `toolCallHandlers.ts:107` handles content blocks)
4. **Alternative fix**: In `handleToolAsk`, always set `enableButtons(true)` regardless of `isPartial`, since a tool ask ALWAYS requires user input

---

## Bug 4: Token Count and Cost Displaying as 0

### Reproduction Steps

1. Open chat, start a task with any API provider (e.g., DeepSeek)
2. Send a message, let the agent process
3. After the agent responds (completes streaming), look at the **TaskHeader** at the top of the chat
4. **Expected**: Shows token count (e.g., "1.2K / 456" tokens) and cost (e.g., "$0.01")
5. **Actual**: Shows "0 / 0" tokens and "$0.00" cost

### Technical Analysis

#### Data Flow (Backend → Frontend)

**Backend writes token data:**

1. Stream completes → [`src/features/api/handlers/stream/streamExecutor/stream-executor-utils.ts:17`](../src/features/api/handlers/stream/streamExecutor/stream-executor-utils.ts:17) `createUpdateApiReqMsg` returns a closure
2. Closure calls [`updateApiReqMsg`](../src/features/api/handlers/stream/on-stream-chunk-received.ts:155)
3. `updateApiReqMsg` computes token costs and writes to `task.messages[state.lastApiReqIndex].text`:
    ```typescript
    task.messages[state.lastApiReqIndex].text = JSON.stringify({
    	...existingData,
    	tokensIn: costResult.totalInputTokens,
    	tokensOut: costResult.totalOutputTokens,
    	cacheWrites: state.cacheWriteTokens,
    	cacheReads: state.cacheReadTokens,
    	cost: state.totalCost ?? costResult.totalCost,
    	cancelReason,
    	streamingFailedMessage,
    } satisfies ApiReqData)
    ```

**Frontend reads token data:**

1. Webview receives updated `messages[]` (via `postStateToWebview` or similar)
2. `computeAskDerivedState` at [`webview-ui/src/features/chat/ask/orchestrators.ts:72-84`](../webview-ui/src/features/chat/ask/orchestrators.ts:83):
    ```typescript
    ui.setApiMetrics(getApiMetrics(modifiedMessages))
    ```
3. `getApiMetrics` is re-exported from [`src/shared/api/getApiMetrics.ts`](../src/shared/api/getApiMetrics.ts):
    ```typescript
    import { consolidateTokenUsage as getApiMetrics } from "@jabberwock/core/browser"
    ```
4. `consolidateTokenUsage` at [`packages/core/src/message-utils/consolidateTokenUsage.ts:29-44`](../packages/core/src/message-utils/consolidateTokenUsage.ts:29):
    - Iterates messages, calls `processApiRequestMessage` for each
    - Finds `api_req_started` with `type: "say"` and `say: "api_req_started"`
    - Parses `message.text` as JSON → `{tokensIn, tokensOut, cacheWrites, cacheReads, cost}`
    - `accumulateTokenUsage` at line 59: only accumulates if values are `typeof === "number"`

**TaskHeader reads metrics:**
[`webview-ui/src/features/chat/task/components/task-header/header.tsx:31-35`](../webview-ui/src/features/chat/task/components/task-header/header.tsx:31):

```typescript
const { apiMetrics } = ui
const { totalTokensIn: tokensIn, totalTokensOut: tokensOut, totalCost, contextTokens } = apiMetrics
```

#### combineApiRequests (pre-processing)

[`packages/core/src/message-utils/consolidateApiRequests.ts:20-50`](../packages/core/src/message-utils/consolidateApiRequests.ts:20):

- Merges `api_req_started` + `api_req_finished` pairs by `{...startData, ...finishData}`
- Called in `computeAskDerivedState` BEFORE `getApiMetrics`
- Should NOT strip token data since `updateApiReqMsg` writes to `api_req_started.text`, and `api_req_finished` properties are merged on top

#### StreamHandle vs Store Reference Issue

In [`src/features/api/handlers/stream/streamExecutor/stream-executor-utils.ts:17-27`](../src/features/api/handlers/stream/streamExecutor/stream-executor-utils.ts:17):

```typescript
return (cancelReason?, streamingFailedMessage?) => {
    updateApiReqMsg(
        sh,
        {
            messages: [...store.chat.tasks.get(taskId)!.notifications.items],  // COPY of messages
            ...
        },
    )
}
```

`updateApiReqMsg` takes `state.messages` (the copy) to READ the existing text, but writes to `task.messages` (the StreamHandle's message array via `sh`). If `sh.messages` is the same reference as `store.chat.tasks.get(taskId)!.notifications.items`, then the mutation is visible to the store → pushes to webview. If different references, the webview never sees the update.

#### Root Cause Hypotheses (ordered by likelihood)

##### H1 (HIGH): `updateApiReqMsg` writes to a different reference than the store's notification list

The `state.messages` is a spread copy `[...store.chat.tasks.get(taskId)!.notifications.items]`. While `updateApiReqMsg` writes to `task.messages[state.lastApiReqIndex].text`, if `sh.messages` points to a different array than the store's notifications, the token data is written to an orphan array that never reaches the webview.

##### H2 (MEDIUM): The webview never re-renders after `updateApiReqMsg` writes the data

Even if the message text is updated correctly, if no state-push mechanism fires after `updateApiReqMsg`, the webview never receives the updated data. The stream completion triggers `saveMessages()` and other effects, but one of these might be broken after the zustand → MST refactoring.

##### H3 (LOW): `consolidateTokenUsage` skips the notification because `combineApiRequests` changes the structure

If `combineApiRequests` merges the `api_req_started` with a following `api_req_finished` that has a JSON-parsing error, the combined text might be malformed. Or if the `api_req_started` text is initially empty `{}` and `updateApiReqMsg` never fires (e.g., due to error), tokens stay 0.

### Fix Approach

1. **Add logging** in `updateApiReqMsg` to confirm it fires and writes correct data
2. **Check** whether `sh.messages` references the same array as the MST store's notification list
3. **If H1**: Change `updateApiReqMsg` to write directly to the store's notification list instead
4. **Check** if `postTaskToWebview` or equivalent state-push function is called after `updateApiReqMsg`
5. **If H2**: Add explicit state push after `createUpdateApiReqMsg` closure executes

---

## Verification Checklist

After fixes:

- [ ] `pnpm lint` passes
- [ ] `pnpm check-types` passes
- [ ] `pnpm test` passes
- [ ] Manual: Start task → confirm Approve/Deny buttons are enabled when tool call is pending
- [ ] Manual: Complete task → confirm token count and cost display non-zero values
- [ ] Manual: Partial streaming → confirm buttons are disabled during streaming, enabled when streaming stops
