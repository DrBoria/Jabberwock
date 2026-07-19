# Fiber IntentBus — MST Snapshot Compatibility Analysis

## The Question

> _"The idea of dispatching through mobx was specifically so that we would have a state snapshot, so that all actions could be viewed and rolled back along a timeline (snapshot apply). In the version you proposed, how would that work?"_

## Short Answer

**It works identically.** The scheduler doesn't bypass MST — it calls MST actions. The DevTool sees the same snapshot boundaries. The only thing that changes is _when_ and _in what order_ handlers execute, not _how_ state mutations are tracked.

## Long Answer — How MST Snapshots Work Today

MST creates a snapshot checkpoint at **every action boundary**. In the current [`IntentBus`](src/features/intents/bus.ts), the snapshot flow per intent is:

```
createIntent() ──→ snapshot (intent queued)
     ↓
setProcessing() ──→ snapshot (intent picked up)
     ↓
await handler() ──→ NO snapshot (plain async call)
     ↓
markSuccess() ────→ snapshot (intent done)
```

The MobX [`reaction()`](src/features/intents/bus.ts:69-82) is **not** an MST action. It's a MobX side-effect callback. The actual MST actions (`createIntent`, `setProcessing`, `markSuccess`, `failIntent`) are called **from inside** the reaction callback. The DevTool's `apply_previous_state` / `apply_next_state` works because MST records each action's snapshot, regardless of what triggered the action.

### Key Insight

The reaction callback is already outside MST. It's just a MobX watcher. The scheduler I proposed would be the same — outside MST, calling MST actions.

Current call stack:

```
MobX reaction()                ← NOT an MST action
  └─ processQueue()            ← NOT an MST action
       └─ setProcessing(id)    ← ✅ MST action → snapshot
       └─ await handler()      ← NOT an MST action
       └─ markSuccess(id)      ← ✅ MST action → snapshot
```

Proposed call stack:

```
MobX reaction()                ← NOT an MST action (UNCHANGED)
  └─ scheduler.enqueue(id)     ← NOT an MST action (NEW — non-blocking)
       ↑
  [scheduler loop runs on microtask]
       ↓
  scheduler.dispatch(id)       ← NOT an MST action
       └─ dispatchIntent(id)   ← ✅ MST action → snapshot (NEW — single action wrapper)
            ├─ setProcessing() ← ✅ snapshot inside dispatchIntent
            ├─ await handler() ← yields may insert more snapshots
            └─ markSuccess()   ← ✅ snapshot inside dispatchIntent
```

**The MST snapshot timeline is identical** — every state mutation still flows through an MST action.

## Concrete Example: Fiber-Enabled IntentBus

Here's how the MST-compatible Fiber IntentBus would work:

### 1. MST Action: `dispatchIntent`

```typescript
// In IntentStoreModel.actions
dispatchIntent(id: string) {
  const intent = self.intents.find(i => i.id === id)
  if (!intent) return

  intent.status = IntentStatus.Processing
  // ← Snapshot captured here by MST
  // The handler executes AFTER this action completes
  // (handlers run outside MST, just like today)
}
```

### 2. MST Action: `suspendIntent` / `resumeIntent` (NEW — for preemption snapshots)

```typescript
suspendIntent(id: string) {
  const intent = self.intents.find(i => i.id === id)
  if (intent) {
    intent.status = IntentStatus.Suspended  // NEW status
    // ← Snapshot captured: intent was processing, now suspended
  }
}

resumeIntent(id: string) {
  const intent = self.intents.find(i => i.id === id)
  if (intent) {
    intent.status = IntentStatus.Processing
    // ← Snapshot captured: intent resumed
  }
}
```

### 3. Scheduler (outside MST, calling MST actions)

```typescript
class FiberIntentBus {
	private queue = new PriorityQueue<FiberWork>()
	private activeFiber: FiberWork | null = null

	start(intentStore: IIntentStore, ctx: IntentHandlerContext) {
		this.disposer = reaction(
			() => intentStore.intents.filter((i) => i.status === IntentStatus.Queued).map((i) => i.id),
			(queuedIds) => {
				for (const id of queuedIds) {
					const intent = intentStore.getById(id)!
					const priority = this.getPriority(intent.type)
					this.queue.enqueue({ id, type: intent.type, priority })
					// ^^ Non-blocking — just feeds the priority queue
					// No MST snapshot here (no state mutation)
				}
				if (!this.isProcessing) {
					this.schedule() // microtask-based scheduler loop
				}
			},
		)
	}

	private async schedule() {
		this.isProcessing = true
		while (this.queue.size > 0) {
			const work = this.queue.dequeue()! // takes highest-priority

			// ⬇️ THIS is the critical line — dispatch through MST action
			// Creates a snapshot boundary exactly like today's setProcessing()
			this.intentStore.dispatchIntent(work.id)

			const handler = this.handlers.get(work.type)!
			// Handler runs as a "fiber" with yield points
			await this.runFiber(handler, work, this.ctx)
		}
		this.isProcessing = false
	}
}
```

### 4. Fiber with Yield Points (optional — only if preemption needed)

```typescript
private async runFiber(handler: IntentHandler, work: FiberWork, ctx: IntentHandlerContext) {
  const fiber = handler()  // handler is an async generator
  let result = await fiber.next()

  while (!result.done) {
    // Yield point — check for higher-priority work
    if (this.queue.hasHigherPriorityThan(work.priority)) {
      // ⬇️ Suspend through MST action → creates snapshot
      this.intentStore.suspendIntent(work.id)

      // Process higher-priority work
      await this.schedule()

      // ⬇️ Resume through MST action → creates snapshot
      this.intentStore.resumeIntent(work.id)
    }

    result = await fiber.next()
  }

  // ⬇️ Mark success through MST action → creates snapshot
  this.intentStore.markSuccess(work.id)
}
```

## DevTool Timeline Comparison

### Current (FIFO, no preemption)

```
Snapshot 1: createIntent(userMessage)     [Queued]
Snapshot 2: setProcessing(userMessage)    [Processing]
   ... handler runs for 30 seconds ...
Snapshot 3: markSuccess(userMessage)      [Success]
```

### Fiber (with preemption)

```
Snapshot 1: createIntent(userMessage)        [Queued]
Snapshot 2: dispatchIntent(userMessage)      [Processing]
Snapshot 3: createIntent(cancelTask)         [Queued]  ← user clicked Stop
Snapshot 4: suspendIntent(userMessage)       [Suspended]
Snapshot 5: dispatchIntent(cancelTask)       [Processing]
Snapshot 6: markSuccess(cancelTask)          [Success]
Snapshot 7: resumeIntent(userMessage)        [Processing]
   ... handler resumes ...
Snapshot 8: markSuccess(userMessage)         [Success]
```

**Every state change is still a snapshot.** The DevTool's `apply_previous_state` and `apply_next_state` navigate this timeline exactly as before.

## What Changes in DevTool?

**Nothing.** The DevTool reads MST snapshots. MST snapshots are created at action boundaries. The Fiber scheduler calls MST actions. Zero changes needed in DevTool.

The only difference: the DevTool timeline would have _more_ snapshots (Suspend/Resume entries) — which is actually _better_ for debugging, since you can see the preemption point in history.

## What About Undo/Redo Safety?

`apply_previous_state` restores a past MST snapshot. In both architectures:

| Scenario           | Current                                              | Fiber                                        |
| ------------------ | ---------------------------------------------------- | -------------------------------------------- |
| Undo `cancelTask`  | Restores snapshot before `createIntent(cancelTask)`  | Same — snapshot exists at same logical point |
| Undo `userMessage` | Restores snapshot before `createIntent(userMessage)` | Same — snapshot exists                       |
| Redo after undo    | MST replays actions from snapshot forward            | Same — actions are replayed identically      |

No change. MST snapshots are action-boundary-based, not time-based.

## Comparison Table

| Aspect               | Current (FIFO)                                | Fiber (Priority)                                           | MST Impact                                     |
| -------------------- | --------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| Queue observation    | MobX `reaction()`                             | MobX `reaction()` (unchanged)                              | None                                           |
| Dispatch             | Inside reaction callback (blocking)           | Scheduler microtask loop (non-blocking)                    | None                                           |
| MST mutations        | Direct calls in processQueue                  | Same direct calls from scheduler                           | None                                           |
| Snapshots per intent | 3-4 (create, setProcessing, markSuccess/fail) | 4-6 (create, dispatch, suspendOpt, resumeOpt, markSuccess) | More detail, no regression                     |
| DevTool undo/redo    | Snapshot-based                                | Same snapshots                                             | None                                           |
| Cancel handling      | Synchronous bypass (direct state mutation)    | Priority queue (cancel intent jumps ahead)                 | Cancel now goes through MST → actually tracked |

## The Only Real Change: Status Model

The only new thing needed is a `Suspended` intent status:

```typescript
;IntentStatus.Queued |
	IntentStatus.Processing |
	IntentStatus.Suspended | // ← NEW
	IntentStatus.Success |
	IntentStatus.Failed
```

This is one line in the `@jabberwock/types` package. The DevTool would see `Suspended` intents in the timeline — more visibility, not less.

## Summary

The MST snapshot system is **orthogonal** to how handlers are scheduled. MST creates snapshots at action boundaries. The Fiber scheduler calls MST actions at the same boundaries (plus optional Suspend/Resume for preemption). The DevTool's undo/redo works identically.

The only change is architectural: instead of one monolithic blocking `reaction()` callback that does both observation and dispatch, we split into:

1. **Observation** (reaction) — non-blocking, feeds priority queue
2. **Dispatch** (scheduler) — calls MST actions in priority order

MST snapshots are preserved 100%.
