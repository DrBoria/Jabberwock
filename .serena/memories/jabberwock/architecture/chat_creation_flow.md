# Complete Chat Creation Flow (End-to-End Verified)

## Entry Points (3 paths converge to same handler)

### Path A: Webview "plus button" → user types → send

1. User clicks VS Code "plus" button → `jabberwock.plusButtonClicked` command
2. `registerCommands.ts:104-122` → clears taskStack, sends `{ type: "action", action: "chatButtonClicked" }` + `{ type: "action", action: "focusInput" }` to webview
3. Webview switches to chat screen. User types and clicks send.
4. `webview-ui/src/features/chat/task/store.ts:20-28` → `vscode.postMessage({ type: "newTask", text, images })`
5. EventBridge receives → `webviewMessageHandler()` at `on-webview-message.ts:43`
6. Registered handler found in `src/features/chat/task/events/handlers/index.ts:26-36`
7. Creates `"task.new.requested"` intent with `payload: { taskId: store.chat.activeTaskId ?? "", text, images }`

### Path B: IPC StartNewTask (devtools/external)

1. `extension.ts:723-737` → creates `TaskNewRequested` (`"task.new.requested"`) intent with `payload: { text, images, taskConfiguration }` (NO taskId)

### Path C: VS Code `jabberwock.newTask` command

1. `registerCommands.ts:166` → `handleNewTask()` → creates `TaskNewRequested` intent

## IntentBus Dispatch (all paths converge here)

1. `bus.ts:74` MobX `reaction()` detects Queued intents
2. `bus.ts:109` `processQueue()` → dispatches to registered handler
3. Handler registered at `on-new-requested.ts:12` with `IntentType.TaskNewRequested`

## Handler: on-new-requested.ts

1. `resolveImageMentions({ text, images, cwd, jabberwockIgnoreController })`
2. `createTask(provider, text, images, { taskId: payload.taskId }, payload.taskConfiguration)`
    - `taskConfiguration` = `{ taskId: payload.taskId }` (empty string `""` when no active task)
    - `_extra` = `payload.taskConfiguration` (unused)
3. Sends `invoke: "newChat"` to webview
4. Sets `ctx.rootStore.chat.setIsRunning(true)`
5. On error: sends `invoke: "newChat"` again, resets isRunning, rethrows

## createTask() in startTask.ts:113

### Branch 1: currentTask exists + text provided (existing task, new message)

1. `registerTask(taskInstance.taskId, taskInstance)`
2. Creates `UserMessageReceived` intent
3. `await when(() => store.chat.isCompleted || store.chat.abort)` ← blocks
4. `unregisterTask(taskInstance.taskId)`
5. Returns currentTask

### Branch 2: No currentTask + text provided (brand new task) ← DEFAULT PATH

1. Reads API config from MST store via `apiModel.toProviderSettings()`
2. `resolvedTaskId = undefined` (empty string from webview path filtered by `length > 0` check)
3. `createTaskModel({ provider, apiConfiguration, task: text, images, taskId: undefined })` → generates new `uuidv7()`
4. `startTask(newTask.taskId, text, images)`

## startTask() in startTask.ts:53

1. `agentBroadcast(taskId, "text", taskText, images)` → shows "Starting new task..." in UI
2. `registerTask(taskId, task)`
3. Creates `UserMessageReceived` intent
4. **`await when(() => store.chat.isCompleted || store.chat.abort)`** ← THE KEY WAIT
5. `unregisterTask(taskId)`

## Reactive Loop (Intentional — no recursion)

1. IntentBus dispatches `UserMessageReceived` → `on-message-received.ts` handler
2. `prepareApiRequest()` → `handleStream()` → `finalizeToolCalls()` → `executeTools()`
3. `executeTools.ts:44-57`: When `waitForToolExecutionAndPrepareNextContent()` returns content:
    - Creates ANOTHER `UserMessageReceived` intent with `{ taskId, content: nextUserContent }`
    - Each iteration is a SEPARATE intent through IntentBus (no stack buildup)
    - This replaces old recursive `processNextMessage` loop

## Completion (when() resolves)

### Normal completion (AttemptCompletionTool):

- `task._state.setIsCompleted(true)` ← TaskModel level
- `getBackendRootStore().chat.setIsCompleted(true)` ← ChatStore level (FIX A)
- ✅ `store.chat.isCompleted` = true → `when()` resolves

### Abort via notification (fallback/cancel):

- `task.setAbort(true)` ← TaskModel level (via `handleNotificationMessage.ts`)
- `getBackendRootStore().chat.setAbort(true)` ← ChatStore level (FIX B)
- ✅ `store.chat.abort` = true → `when()` resolves

### Abort via abortTask.ts:

- `task._state.setAbort(true)` + `store.chat.setAbort(true)` ← ALREADY correct pattern
- ✅ Both levels set → `when()` resolves

## Cleanup

1. `startTask()` returns → `createTask()` returns → `on-new-requested.ts` handler returns
2. IntentBus `processQueue()` marks `TaskNewRequested` as Success

## Verified Correctness

- ✅ No IntentBus bypasses anywhere in the codebase
- ✅ The reactive loop in executeTools is the designed, intentional behavior
- ✅ All three entry paths converge to `on-new-requested.ts:12` handler
- ✅ Empty `taskId` from webview is correctly filtered by `length > 0` guard at `startTask.ts:170`
- ✅ `resumeTask.ts:314` also benefits from the same `when()` fix

## Files Referenced

- `src/extension.ts:723-737` — IPC StartNewTask handler
- `src/features/chat/task/events/handlers/index.ts:26-36` — Webview "newTask" → intent bridge
- `src/features/foundation/webview/events/handlers/on-webview-message.ts` — Message routing
- `src/features/chat/task/handlers/on-new-requested.ts` — TaskNewRequested handler
- `src/features/chat/task/actions/startTask.ts` — createTask() + startTask()
- `src/features/chat/task/actions/createTaskModel.ts` — TaskModel creation
- `src/features/chat/task/handlers/user/on-message-received.ts` — UserMessageReceived handler
- `src/features/chat/tools/actions/executeTools.ts` — Reactive loop (intentional)
- `src/features/chat/tools/AttemptCompletionTool.ts` — Completion + FIX A
- `src/features/chat/task/messages/actions/handleNotificationMessage.ts` — FIX B
- `src/features/chat/task/actions/abortTask.ts` — Reference pattern (already correct)
- `src/features/intents/bus.ts` — IntentBus reaction + processQueue
- `src/features/chat/store.ts` — ChatStoreModel (has abort, isCompleted, setAbort, setIsCompleted)
- `src/activate/registerCommands.ts:104-122` — plusButtonClicked handler
- `webview-ui/src/features/chat/task/store.ts:20-28` — Webview sendMessage
