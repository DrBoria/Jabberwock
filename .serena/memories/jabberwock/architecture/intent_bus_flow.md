# Intent Bus Architecture Analysis

## Complete Chat Creation Flow

webview `StartNewTask` →
`extension.ts:723-736` creates `TaskNewRequested` intent (NO taskId in payload) →
`IntentBus.start()` MobX `reaction()` picks up Queued intents →
`IntentBus.processQueue()` dispatches to handler →
`on-new-requested.ts:12-67` handler: - `resolveImageMentions(text, images)` - `createTask(provider, text, images, {taskId}, taskConfiguration)` - No currentTask → branch 2 (startTask.ts:152) - `rawTaskId = taskConfiguration?.taskId = undefined` - `createTaskModel({..., taskId: undefined})` → task created with uuidv7() - `startTask(taskId, text, images)` - agentBroadcast, registerTask - Creates `UserMessageReceived` intent - **`await when(() => store.chat.isCompleted || store.chat.abort)`**

## IntentBus Reaction Pipeline

`IntentBus.start()` at bus.ts:74-93:

- MobX `reaction()` watches `intents.filter(i => i.status === Queued).map(i => i.id)`
- When new queued IDs appear, adds to `processingQueue` and calls `processQueue()`

`processQueue()` at bus.ts:109-152:

- Sequential processing: `while (processingQueue.length > 0)`
- Gets handler via `this.handlers.get(intent.type)`
- Calls `handler()`, then `markSuccess(id)` on success
- On error: `failIntent(id)`, creates `system.failure` intent, continues to next

Handler chaining: if multiple `register()` calls for same type, they're composed (bus.ts:52-56)

## UserMessageReceived Handler Pipeline

`on-message-received.ts:10-95`:

- Gets task from registry (module-level Map)
- Gets taskModel from MST store
- Guards: skip if `isProcessing` or `store.chat.abort`
- Builds userContent from text/images or content blocks
- **prepareApiRequest()** → **handleStream()** → **finalizeToolCalls()** → **executeTools()**

## The "Reactive Loop" (Intentional)

`executeTools.ts:44-57`: When `waitForToolExecutionAndPrepareNextContent()` returns content:

- Creates another `UserMessageReceived` intent with `{taskId, content: nextUserContent}`
- This creates a chain: `UserMessageReceived → handler → executeTools → UserMessageReceived → ...`
- Each iteration is a SEPARATE intent through the IntentBus (no recursion/stack buildup)
- This replaces the old recursive `processNextMessage` loop

## Retry Flow

`handleStream.ts:380-389`: On stream failure (non-abort):

- Creates another `UserMessageReceived` intent with original content
- The handler re-processes the same user content as a retry

`executeTools.ts:91-98`: On no-assistant-messages with user clicking "retry":

- Creates another `UserMessageReceived` intent

## Completion Flow

`AttemptCompletionTool.ts:80`: Sets `task._state.setIsCompleted(true)` (TASK MODEL level)
`emitTaskCompleted()`: Emits `TaskCompleted` event, captures telemetry

## Found Issues

### BUG 1: `store.chat.isCompleted` NEVER set

- `AttemptCompletionTool` sets `task._state.isCompleted` (TaskModel level)
- But `startTask()` waits on `store.chat.isCompleted` (ChatStoreModel level)
- These are DIFFERENT properties in different MST models
- Result: `startTask()`'s `when()` NEVER resolves for normally completing tasks
- The handler chain hangs on `createTask()` call → `TaskNewRequested` intent stays "Processing" forever
- Abort path still works: `abortTask.ts:18` sets `store.chat.setAbort(true)` ✓

### BUG 2: `handleNotificationMessage.ts` misses store-level abort

- Lines 38,46: Sets `task.setAbort(true)` (TASK level) but NOT `store.chat.setAbort(true)`
- The polling loop in `toolCallExecutor.ts:182` detects `task._state.abort` and stops
- But `startTask()`'s `when()` won't detect this abort path
- This only affects notification-driven aborts (fallback/cancel actions)

### No Intent Bus Bypasses Found

All state changes go through `store.intentStore.createIntent()` → IntentBus reaction → handler. No direct handler calls detected.

### The "Single Exception" (Reactive Loop)

The intentional loop: `UserMessageReceived` handler → executeTools → creates another `UserMessageReceived` intent. This is the designed replacement for the old recursive loop. It's NOT a bypass — each iteration is a separate intent going through the IntentBus.
