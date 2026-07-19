# Target IntentBus Architecture — Fiber Priority Dispatch

## Key Changes from Current Architecture

See `mem:architecture/intentbus-current` for the current architecture being migrated from.

### 1. Observation and Execution Are Decoupled

The MobX `reaction()` callback does NOT execute handlers. It only feeds the priority queue:

```typescript
this.disposer = reaction(
	() => intentStore.intents.filter((i) => i.status === IntentStatus.Queued).map((i) => i.id),
	(queuedIds) => {
		for (const id of queuedIds) {
			const intent = intentStore.getById(id)!
			const priority = INTENT_PRIORITY[intent.type] ?? IntentPriority.Normal
			this.queue.enqueue({ id, type: intent.type, priority })
		}
		if (!this.isProcessing) {
			queueMicrotask(() => this.schedule()) // ← Non-blocking microtask
		}
	},
)
```

**No `await` in the reaction callback.** The reaction is synchronous and non-blocking.

### 2. Priority Queue Replaces FIFO Array

```typescript
class PriorityQueue<T extends { priority: number }> {
	private items: T[] = []

	enqueue(item: T): void {
		// Insert sorted by priority (lower = higher priority)
		const idx = this.items.findIndex((i) => i.priority > item.priority)
		if (idx === -1) this.items.push(item)
		else this.items.splice(idx, 0, item)
	}

	dequeue(): T | undefined {
		return this.items.shift()
	}
	hasHigherPriorityThan(p: number): boolean {
		return this.items.length > 0 && this.items[0].priority < p
	}
	get size(): number {
		return this.items.length
	}
}
```

### 3. Scheduler with Yield Points

```typescript
private async schedule(): Promise<void> {
  if (this.isProcessing) return
  this.isProcessing = true
  try {
    while (this.queue.size > 0) {
      const work = this.queue.dequeue()!
      this.intentStore.dispatchIntent(work.id)  // ← MST action → snapshot
      const handler = this.handlers.get(work.type)
      if (!handler) { this.intentStore.markSuccess(work.id); continue }
      try {
        await this.runFiber(handler, work, this.intentStore)
        this.intentStore.markSuccess(work.id)  // ← MST action → snapshot
      } catch (err) {
        this.intentStore.failIntent(work.id)  // ← MST action → snapshot
      }
    }
  } finally {
    this.isProcessing = false
  }
}

private async runFiber(
  handler: IntentHandler, work: FiberWork, store: IIntentStore
): Promise<void> {
  // Handler calls await scheduler.yield() at safe points
  // This allows preemption check
}
```

**`yield()` method:** Handlers call `await scheduler.yield()` at safe points. The scheduler checks the priority queue for higher-priority work:

```typescript
async yield(): Promise<void> {
  if (this.queue.hasHigherPriorityThan(this.activeFiber!.priority)) {
    const fiber = this.activeFiber!
    this.intentStore.suspendIntent(fiber.id)  // ← MST action → snapshot
    await this.schedule()                      // Process higher-priority items
    this.intentStore.resumeIntent(fiber.id)   // ← MST action → snapshot
  }
}
```

### 4. New MST Actions on IntentStoreModel

- `dispatchIntent(id)` — sets status to Processing
- `suspendIntent(id)` — sets status to Suspended
- `resumeIntent(id)` — sets status back to Processing

### 5. New IntentStatus.Suspended

```typescript
export enum IntentStatus {
	Queued = "queued",
	Processing = "processing",
	Suspended = "suspended", // NEW
	Success = "success",
	Failed = "failed",
}
```

### 6. Priority Field on IntentModel

```typescript
priority: types.maybe(types.number),  // 0=Critical, 1=High, 2=Normal, 3=Low
```

### 7. INTENT_PRIORITY Map

Both `IntentConstants.ts` files export a priority map:

```typescript
export const IntentPriority = { Critical: 0, High: 1, Normal: 2, Low: 3 } as const
export const INTENT_PRIORITY: Record<string, IntentPriority> = {
	"task.cancel.requested": IntentPriority.Critical,
	"system.failure": IntentPriority.Critical,
	"user.message.received": IntentPriority.High,
	// ... etc
}
```

### 8. Cancel Goes Through IntentBus (No Synchronous Bypass)

The Stop handler no longer directly mutates store state. It creates a `Critical`-priority cancel intent:

```typescript
intentStore.createIntent({
	type: IntentConstants.core.TASK_CANCEL_REQUESTED,
	priority: IntentPriority.Critical,
	// ...
})
```

The scheduler picks it up immediately (Critical jumps the queue), preempts the current fiber at the next yield point, and dispatches the cancel handler. Task-level abort (`task._state.setAbort(true)` + `abortController.abort()`) is still used for the actual cancellation, but `store.chat.abort` is no longer set.

### 9. MST Snapshot Preservation

The scheduler calls MST actions (`dispatchIntent`, `suspendIntent`, `resumeIntent`, `markSuccess`, `failIntent`). Every state mutation creates an MST snapshot. The DevTool's undo/redo (`apply_previous_state` / `apply_next_state`) sees the same timeline as before, with additional Suspend/Resume entries for preemption points.

DevTool timeline comparison:

- **Before (FIFO)**: `createIntent → setProcessing → markSuccess` (3 snapshots)
- **After (Fiber, with preemption)**: `createIntent → dispatchIntent → suspendIntent → dispatchIntent(cancel) → markSuccess(cancel) → resumeIntent → markSuccess` (7 snapshots)

### 10. Handler Yield-Safety

Handlers that call `await scheduler.yield()` must handle suspension:

```typescript
async function handler(intent, ctx) {
	// ... do some work ...
	await ctx.scheduler.yield()
	// After yield: check if we were suspended or even cancelled
	const current = ctx.intentStore.getById(intent.id)
	if (current?.status !== IntentStatus.Processing) {
		return // Was cancelled while suspended — bail out
	}
	// ... continue ...
}
```

### Files to Change

- `packages/types/src/intents/types.ts` — add `Suspended` to IntentStatus enum
- `src/features/intents/bus.ts` — rewrite with PriorityQueue + Fiber scheduler
- `src/features/intents/store.ts` — add `dispatchIntent`, `suspendIntent`, `resumeIntent` actions + priority field
- `src/features/intents/IntentConstants.ts` — add `INTENT_PRIORITY` map
- `webview-ui/src/features/intents/bus.ts` — same rewrite
- `webview-ui/src/features/intents/store.ts` — same changes
- `webview-ui/src/features/intents/IntentConstants.ts` — add `INTENT_PRIORITY` map
- `src/features/chat/task/events/handlers/register-on-task-intents.ts` — remove synchronous bypass, use Critical-priority cancel intent
- `src/features/chat/task/actions/abortTask.ts` — remove `store.chat.setAbort(true)`
- `src/features/chat/task/messages/handlers/user/on-message-received.ts` — add yield points
