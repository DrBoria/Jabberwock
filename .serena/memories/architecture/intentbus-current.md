# Current IntentBus Architecture — FIFO-blocking (being migrated away from)

## IntentBus Class

Both frontend (`webview-ui/src/features/intents/bus.ts`) and backend (`src/features/intents/bus.ts`) share the same FIFO-blocking architecture.

### Structure

- `handlers: Map<string, IntentHandler>` — registered handler per intent type. Multiple handlers for same type are chained (registration order).
- `isProcessing: boolean` — lock flag preventing concurrent queue processing.
- `processingQueue: string[]` — simple FIFO array of intent IDs awaiting dispatch.
- `disposer: (() => void) | null` — MobX reaction disposer.

### Dispatch Mechanism

1. **Observation + Execution are coupled**: The MobX `reaction()` callback both observes AND dispatches:

    ```typescript
    this.disposer = reaction(
    	() => intentStore.intents.filter((i) => i.status === IntentStatus.Queued).map((i) => i.id),
    	async (queuedIds) => {
    		for (const id of queuedIds) {
    			if (!this.processingQueue.includes(id)) this.processingQueue.push(id)
    		}
    		if (!this.isProcessing) {
    			await this.processQueue(intentStore, ctx) // ← BLOCKING await in reaction
    		}
    	},
    )
    ```

2. **`processQueue()` is fully blocking**: Sets `isProcessing=true`, then loops through `processingQueue` with `await handler()`. While a handler runs (e.g., streaming for 30 seconds), NO other intents can be dispatched. The queue is completely blocked.

3. **`register()` chains handlers**: Multiple handlers for same type run in registration order. No priority, no ordering.

### IntentStoreModel

Both frontend (`webview-ui/src/features/intents/store.ts`) and backend (`src/features/intents/store.ts`) have the same model:

- **Statuses**: `Queued | Processing | Success | Failed` — NO `Suspended` status.
- **No priority field**: Intents have no priority — strictly FIFO.
- **Actions**: `createIntent()`, `markSuccess()`, `failIntent()`, `removeIntent()`, `setProcessing()`, `clearAll()`.
- **No `dispatchIntent()` / `suspendIntent()` / `resumeIntent()`**: These MST actions don't exist.

### Architectural Problem

The FIFO-blocking architecture cannot handle cancel/urgent intents while a long-running handler is active. Since handlers run as `await handler()`, the queue blocks for seconds/minutes. The cancel intent sits in the queue indefinitely behind the current intent.

### Workaround (Current Code)

The Stop handler in `register-on-task-intents.ts:62-75` bypasses the IntentBus entirely with direct synchronous state mutations:

```typescript
store.chat.setAbort(true)
store.chat.setIsRunning(false)
activeTask?.abortTask?.()
store.chat.tasks.get(taskId)?.cancelCurrentRequest?.()
```

This creates a secondary problem: `store.chat.abort` conflates "stop signal" (transient, should reset) with "lock signal" (persistent, prevents new processing). Details in `mem:architecture/abort-flag-dual-purpose`.

### MobX Reaction Detail

The MobX `reaction()` callback is NOT an MST action — it's a plain MobX side-effect. MST actions (`createIntent`, `setProcessing`, `markSuccess`, `failIntent`) are called FROM inside the reaction callback. This is important because it means the reaction is already outside MST — the fiber scheduler would do the same.

### IntentConstants

Both sides define `IntentType` constants but NO priority map. Intent types are flat string constants with no associated priority metadata.

### Files

- Backend bus: `src/features/intents/bus.ts` (121 lines)
- Backend store: `src/features/intents/store.ts` (105 lines)
- Backend constants: `src/features/intents/IntentConstants.ts`
- Backend context: `src/features/intents/context.ts`
- Frontend bus: `webview-ui/src/features/intents/bus.ts` (identical pattern)
- Frontend store: `webview-ui/src/features/intents/store.ts` (identical pattern)
- Frontend constants: `webview-ui/src/features/intents/IntentConstants.ts`
- Shared types: `packages/types/src/intents/types.ts` (IntentStatus enum without Suspended)
- Shared core: `packages/types/src/intents/core/constants.ts` (IntentTypeCore)
- Shared settings: `packages/types/src/intents/settings/constants.ts` (IntentTypeSettings)
