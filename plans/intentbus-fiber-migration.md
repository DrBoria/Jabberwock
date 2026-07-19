# IntentBus Fiber Migration Plan

## Scope — What Gets Migrated and What Doesn't

### Migrated to Fiber

| Component                                                                         | Change                                                                                                 | Rationale                                        |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Backend `IntentBus` (`src/features/intents/bus.ts`)                               | Rewrite: FIFO array → PriorityQueue + Fiber scheduler                                                  | Cancel intents must preempt streaming handlers   |
| Backend `IntentStoreModel` (`src/features/intents/store.ts`)                      | Add: `dispatchIntent`, `suspendIntent`, `resumeIntent` actions + `priority` field + `Suspended` status | MST hooks for scheduler lifecycle                |
| Backend `IntentConstants` (`src/features/intents/IntentConstants.ts`)             | Add: `INTENT_PRIORITY` map with 4 buckets                                                              | Priority metadata per intent type                |
| Frontend `IntentBus` (`webview-ui/src/features/intents/bus.ts`)                   | Same rewrite as backend                                                                                | Symmetry — frontend also needs cancel preemption |
| Frontend `IntentStoreModel` (`webview-ui/src/features/intents/store.ts`)          | Same additions as backend                                                                              | Symmetry                                         |
| Frontend `IntentConstants` (`webview-ui/src/features/intents/IntentConstants.ts`) | Same additions as backend                                                                              | Symmetry                                         |
| `IntentStatus` enum (`packages/types/src/intents/types.ts`)                       | Add `Suspended = "suspended"`                                                                          | Shared type for both sides                       |
| Stop handler (`register-on-task-intents.ts`)                                      | Remove synchronous bypass → create Critical cancel intent                                              | Eliminate direct state mutation workaround       |
| `abortTask.ts`                                                                    | Remove `store.chat.setAbort(true)`                                                                     | Store-level abort flag no longer needed          |
| `on-message-received.ts`                                                          | Add yield points (`await scheduler.yield()`)                                                           | Allow scheduler to preempt at safe points        |
| `executeTools.ts` (tool loop)                                                     | Add yield points before each tool iteration                                                            | Allow cancel during tool execution               |

### NOT Migrated

| Component                                                              | Reason                                                                                                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `EventBridge` class (`src/features/foundation/webview/EventBridge.ts`) | EventBridge is pure IPC — no queue, no blocking, no handlers. It extends `EventEmitter` and calls `postMessage()`. No fiber changes needed. |
| Event handler files (`events/handlers/on-*.ts`)                        | Event handlers are stateless and instant — they receive an event, create an intent, return. No long-running work, no yield points needed.   |
| `sendStreamChunk.ts` (streaming exception)                             | Already outside MST — direct `webview.postMessage()`. No blocking, no fiber changes needed.                                                 |
| `StreamingStore` (frontend, non-MST)                                   | Already non-blocking reactive store. No fiber changes needed.                                                                               |
| MST stores other than IntentStore                                      | No changes needed — they are mutated by handlers, not by the scheduler.                                                                     |
| EventConstants (shared types package)                                  | Constants don't change — only IntentConstants get the priority map.                                                                         |
| Class names (`IntentBus`, `IntentStore`, `IntentStoreModel`)           | **Names stay the same.** No rename to `FiberIntentBus` or similar. Only functionality changes.                                              |
| `register()` chaining pattern                                          | Multiple handlers per type still chain in registration order. Handlers within a type run sequentially.                                      |
| All other files in the target directory structure                      | Not related to dispatch mechanism.                                                                                                          |

### Names That Stay the Same

The user explicitly stated: **"the names stay the same everywhere, we just change the functionality"**.

| Symbol       | Current Name                                                 | Stays As                                                     |
| ------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Bus class    | `IntentBus`                                                  | `IntentBus`                                                  |
| Store model  | `IntentStoreModel`                                           | `IntentStoreModel`                                           |
| MST actions  | `createIntent`, `setProcessing`, `markSuccess`, `failIntent` | Same + new `dispatchIntent`, `suspendIntent`, `resumeIntent` |
| Constants    | `IntentConstants`                                            | `IntentConstants`                                            |
| Priority map | N/A (new)                                                    | `INTENT_PRIORITY`                                            |
| Scheduler    | N/A (internal)                                               | Private method on `IntentBus`, not exposed                   |
| Yield helper | N/A (new)                                                    | `scheduler.yield()` via context                              |

---

## How Each Bus Changes

### Backend IntentBus — Before vs After

#### Before (Current — 121 lines)

```
IntentBus
├── handlers: Map<string, IntentHandler>
├── isProcessing: boolean
├── processingQueue: string[]          ← FIFO array
├── disposer: (() => void) | null
│
├── register(type, handler)            ← chained registration
├── start(store, ctx)
│   └── reaction()                     ← observes + BLOCKING await
├── stop()
└── processQueue()                     ← blocking loop with await handler()
```

**Reaction callback** (coupled observation + execution):

```typescript
;async (queuedIds) => {
	for (const id of queuedIds) this.processingQueue.push(id)
	if (!this.isProcessing) {
		await this.processQueue(store, ctx) // ← BLOCKING
	}
}
```

**processQueue** (blocking FIFO loop):

```typescript
while (this.processingQueue.length > 0) {
	const id = this.processingQueue.shift()!
	// ... setProcessing, await handler(), markSuccess/failIntent ...
}
```

#### After (Target — ~180 lines)

```
IntentBus
├── handlers: Map<string, IntentHandler>
├── isProcessing: boolean
├── queue: PriorityQueue<FiberWork>    ← priority-sorted queue
├── activeFiber: FiberWork | null      ← currently executing work
├── disposer: (() => void) | null
│
├── register(type, handler)            ← unchanged
├── start(store, ctx)
│   └── reaction()                     ← observes only, NO await (non-blocking)
├── stop()                             ← unchanged
├── schedule()                         ← microtask loop, dequeues by priority
├── runFiber(handler, work, store)     ← runs handler with yield support
└── yield()                            ← called by handlers, checks preemption
```

**Reaction callback** (decoupled — observation only):

```typescript
;(queuedIds) => {
	for (const id of queuedIds) {
		const intent = store.getById(id)!
		const priority = INTENT_PRIORITY[intent.type] ?? IntentPriority.Normal
		this.queue.enqueue({ id, type: intent.type, priority })
	}
	if (!this.isProcessing) {
		queueMicrotask(() => this.schedule()) // ← NON-BLOCKING
	}
}
```

**PriorityQueue** (sorted insert):

```typescript
class PriorityQueue<T extends { priority: number }> {
	private items: T[] = []
	enqueue(item: T): void {
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

**schedule** (fiber-aware dispatcher):

```typescript
private async schedule(): Promise<void> {
  if (this.isProcessing) return
  this.isProcessing = true
  try {
    while (this.queue.size > 0) {
      const work = this.queue.dequeue()!
      this.intentStore.dispatchIntent(work.id)
      const handler = this.handlers.get(work.type)
      if (!handler) { this.intentStore.markSuccess(work.id); continue }
      try {
        this.activeFiber = work
        await this.runFiber(handler, work, this.intentStore)
        this.activeFiber = null
        this.intentStore.markSuccess(work.id)
      } catch (err) {
        this.activeFiber = null
        this.intentStore.failIntent(work.id)
      }
    }
  } finally {
    this.isProcessing = false
  }
}
```

**yield** (preemption checkpoint):

```typescript
async yield(): Promise<void> {
  if (!this.activeFiber) return
  if (this.queue.hasHigherPriorityThan(this.activeFiber.priority)) {
    const fiber = this.activeFiber
    this.intentStore.suspendIntent(fiber.id)
    await this.schedule()
    this.intentStore.resumeIntent(fiber.id)
  }
}
```

### Frontend IntentBus

**Identical changes** as backend `bus.ts`. The frontend IntentBus will have the same `PriorityQueue`, `schedule()`, `runFiber()`, and `yield()` methods. The only difference is the `IntentHandlerContext` type (frontend context vs backend context) and the `IntentHandler` type parameters.

### EventBus (EventBridge)

**No changes needed.** The EventBridge:

1. Extends `EventEmitter` — pure pub/sub, no queue, no blocking
2. Calls `postMessage()` — fire-and-forget IPC, no await
3. Event handlers (`events/handlers/on-*.ts`) are stateless and instant — they receive an event, call `intentStore.createIntent()`, return
4. No long-running work in event handlers — they never need to yield

The EventBridge was never the bottleneck. Cancel intents were blocked because the **IntentBus** was blocked, not the EventBridge. The EventBridge already delivers events instantly — it was the IntentBus's FIFO `processQueue()` that couldn't dispatch the cancel intent.

---

## Step-by-Step Migration

### Step 1: Shared Types (`packages/types/src/intents/types.ts`)

**File**: [`packages/types/src/intents/types.ts`](packages/types/src/intents/types.ts)

Add `Suspended` to the enum:

```typescript
export enum IntentStatus {
	Queued = "queued",
	Processing = "processing",
	Suspended = "suspended", // ← ADD THIS
	Success = "success",
	Failed = "failed",
}
```

No other changes to this file. The `Intent` interface doesn't need a `priority` field — priority is an MST-only concern, assigned at creation time from the `INTENT_PRIORITY` map.

### Step 2: Backend IntentStore (`src/features/intents/store.ts`)

**File**: [`src/features/intents/store.ts`](src/features/intents/store.ts)

Changes:

1. Add `Suspended` to the MST enum array:
    ```typescript
    status: types.enumeration("IntentStatus", [
      IntentStatus.Queued,
      IntentStatus.Processing,
      IntentStatus.Suspended,  // ← ADD
      IntentStatus.Success,
      IntentStatus.Failed,
    ]),
    ```
2. Add optional `priority` field to `IntentModel`:
    ```typescript
    priority: types.maybe(types.number),
    ```
3. Add three new actions:
    ```typescript
    dispatchIntent(id: string) {
      const intent = self.intents.find(i => i.id === id)
      if (intent) intent.status = IntentStatus.Processing
    },
    suspendIntent(id: string) {
      const intent = self.intents.find(i => i.id === id)
      if (intent) intent.status = IntentStatus.Suspended
    },
    resumeIntent(id: string) {
      const intent = self.intents.find(i => i.id === id)
      if (intent) intent.status = IntentStatus.Processing
    },
    ```
4. Update `createIntent` signature to accept optional `priority`:
    ```typescript
    createIntent(intent: {
      id: string
      type: string
      payload: IIntentPayload
      status?: IntentStatus
      priority?: number  // ← ADD
      createdAt: number
      traceId?: string
      parentId?: string
    }) {
      self.intents.push({
        ...intent,
        status: intent.status ?? IntentStatus.Queued,
      })
    },
    ```
5. Update the `IIntentPayload` type if needed — not required, `priority` is on the model, not payload.

### Step 3: Backend IntentConstants (`src/features/intents/IntentConstants.ts`)

**File**: [`src/features/intents/IntentConstants.ts`](src/features/intents/IntentConstants.ts)

Add priority types and map:

```typescript
export const IntentPriority = {
	Critical: 0,
	High: 1,
	Normal: 2,
	Low: 3,
} as const

export type IntentPriority = (typeof IntentPriority)[keyof typeof IntentPriority]

export const INTENT_PRIORITY: Record<string, IntentPriority> = {
	"task.cancel.requested": IntentPriority.Critical,
	"system.failure": IntentPriority.Critical,
	"user.message.received": IntentPriority.High,
	"ask.response.received": IntentPriority.High,
	"tool.execution.required": IntentPriority.High,
	"message.agent.broadcast": IntentPriority.Normal,
	"message.system.broadcast": IntentPriority.Normal,
	"message.mcp.broadcast": IntentPriority.Normal,
	"message.user.broadcast": IntentPriority.Normal,
	"notification.ask.tool_approval": IntentPriority.Normal,
	"notification.ask.follow_up": IntentPriority.Normal,
	"notification.ask.sub_task": IntentPriority.Normal,
	"notification.persist": IntentPriority.Normal,
	"api.streaming.started": IntentPriority.Normal,
	"api.streaming.ended": IntentPriority.Normal,
	"file.context.tracked": IntentPriority.Normal,
	"log.write": IntentPriority.Low,
	"agent.request.failed": IntentPriority.Low,
	"mcp.tool.result": IntentPriority.Low,
}
```

### Step 4: Backend IntentBus (`src/features/intents/bus.ts`)

**File**: [`src/features/intents/bus.ts`](src/features/intents/bus.ts)

Full rewrite. Key structural changes:

1. **Remove `processingQueue: string[]`** → replace with `queue: PriorityQueue<FiberWork>`
2. **Add `activeFiber: FiberWork | null`** — track currently executing work for preemption checks
3. **Rewrite `start()` reaction** — remove `await`, use `queueMicrotask` for scheduling
4. **Replace `processQueue()`** with `schedule()` + `runFiber()` + `yield()`
5. **Add `IntentHandlerContext` augmentation** — expose `scheduler` with `yield()` method on the context

Context changes for yield support:

```typescript
// In context.ts — add scheduler to context
export interface IntentHandlerContext {
	rootStore: IBackendRootStore
	intentStore: IIntentStore
	provider?: EventBridge
	scheduler?: {
		yield(): Promise<void>
	}
}
```

Handlers use yield like:

```typescript
async function handler(intent, ctx) {
	await ctx.scheduler?.yield()
	// Check if we were cancelled while suspended
	const current = ctx.intentStore.getById(intent.id)
	if (current?.status !== IntentStatus.Processing) return
}
```

### Step 5: Frontend IntentStore + IntentConstants + IntentBus

**Files**:

- [`webview-ui/src/features/intents/store.ts`](webview-ui/src/features/intents/store.ts)
- [`webview-ui/src/features/intents/IntentConstants.ts`](webview-ui/src/features/intents/IntentConstants.ts)
- [`webview-ui/src/features/intents/bus.ts`](webview-ui/src/features/intents/bus.ts)
- [`webview-ui/src/features/intents/context.ts`](webview-ui/src/features/intents/context.ts)

Identical changes as backend Steps 2-4. The frontend `INTENT_PRIORITY` map covers frontend-specific intent types (chat, task, settings, foundation, etc.).

### Step 6: Remove Synchronous Bypass in Stop Handler

**File**: [`src/features/chat/task/events/handlers/register-on-task-intents.ts`](src/features/chat/task/events/handlers/register-on-task-intents.ts)

Current (bypass):

```typescript
// Synchronous bypass — directly mutates store state
store.chat.setAbort(true)
store.chat.setIsRunning(false)
activeTask?.abortTask?.()
store.chat.tasks.get(taskId)?.cancelCurrentRequest?.()
store.intentStore.createIntent({ type: "task.cancel.requested", ... })
```

Target (fiber):

```typescript
// Create Critical-priority cancel intent — IntentBus handles dispatch
store.chat.setIsRunning(false)

// Task-level abort (still needed for actual stream cancellation)
activeTask?.abortTask?.()
store.chat.tasks.get(taskId)?.cancelCurrentRequest?.()

// Create cancel intent with Critical priority
store.intentStore.createIntent({
	id: crypto.randomUUID(),
	type: "task.cancel.requested",
	payload: { taskId },
	priority: IntentPriority.Critical, // ← Critical — jumps the queue
	createdAt: Date.now(),
})
```

**No `store.chat.setAbort(true)`** — the store-level abort flag is no longer set. The guard check in `on-message-received.ts` that reads `store.chat.abort` becomes irrelevant for the cancel flow.

### Step 7: Update `abortTask.ts`

**File**: [`src/features/chat/task/actions/abortTask.ts`](src/features/chat/task/actions/abortTask.ts)

Remove `store.chat.setAbort(true)`:

```typescript
// Before:
store.chat.setAbort(true)
task._state.setAbort(true)
task._state.cancelCurrentRequest()

// After:
task._state.setAbort(true)
task._state.cancelCurrentRequest()
```

Task-level `_state.abort` still handles actual cancellation (AbortController, stream cleanup). Store-level `store.chat.abort` is no longer part of the cancel flow.

### Step 8: Add Yield Points to Long-Running Handlers

**File**: [`src/features/chat/task/messages/handlers/user/on-message-received.ts`](src/features/chat/task/messages/handlers/user/on-message-received.ts)

Add yield points:

```typescript
// Before the abort check (first yield point)
await ctx.scheduler?.yield()
const current = ctx.intentStore.getById(intent.id)
if (current?.status !== IntentStatus.Processing) return

// After handleStream (second yield point)
await handleStream(...)
await ctx.scheduler?.yield()
const current2 = ctx.intentStore.getById(intent.id)
if (current2?.status !== IntentStatus.Processing) return

// Before executeTools (third yield point)
await ctx.scheduler?.yield()
// ... executeTools ...
```

Also update abort branch — remove `store.chat.setAbort(false)` since the store-level flag is no longer set:

```typescript
if (taskModel._state.abort) {
	taskModel.setIsProcessing(false)
	// store.chat.setAbort(false) — NOT NEEDED, wasn't set
	return
}
```

### Step 9: Add Yield Points to Tool Execution Loop

**File**: [`src/features/chat/tools/actions/executeTools.ts`](src/features/chat/tools/actions/executeTools.ts)

Add yield at the start of each tool iteration:

```typescript
while (shouldContinue) {
	await ctx.scheduler?.yield()
	const current = ctx.intentStore.getById(intent.id)
	if (current?.status !== IntentStatus.Processing) return

	// ... tool execution ...
}
```

---

## Migration Order (Dependency-Safe)

```
Step 1: Shared types (IntentStatus.Suspended)
  │
  ▼
Step 2: Backend IntentStore (Suspended + priority + new actions)
  │
  ▼
Step 3: Backend IntentConstants (INTENT_PRIORITY map)
  │
  ▼
Step 4: Backend IntentBus (PriorityQueue + Fiber scheduler)
  │
  ▼
Step 5: Frontend IntentStore + IntentConstants + IntentBus
  │
  ▼
Step 6: Stop handler (remove synchronous bypass)
  │
  ▼
Step 7: abortTask.ts (remove store.chat.setAbort)
  │
  ▼
Step 8: on-message-received.ts (add yield points)
  │
  ▼
Step 9: executeTools.ts (add yield points)
```

Steps 1-5 can be done in parallel per-side (backend + frontend). Steps 6-9 depend on steps 1-5 being complete.

---

## What Happens to `store.chat.abort` After Migration

The `store.chat.abort` flag was introduced as a workaround for the FIFO-blocking problem. After the fiber migration:

| Concern                              | Old mechanism                                             | New mechanism                                                                                |
| ------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Stop signal                          | `store.chat.setAbort(true)` — synchronous direct mutation | `createIntent({type: "task.cancel.requested", priority: Critical})` — goes through IntentBus |
| Lock signal (prevent new processing) | `store.chat.abort` checked in guard                       | Not needed — cancel intent preempts before new UserMessageReceived is created                |

The `store.chat.abort` flag and its `setAbort()` action can be **removed entirely** from the ChatStore model after the migration is verified. The abort flag was always a band-aid for the architectural gap, not a legitimate store concern.

---

## DevTool Timeline Impact

### Before (FIFO, synchronous bypass)

```
Snapshot 1: createIntent(userMessage)     [Queued]
Snapshot 2: setProcessing(userMessage)    [Processing]
   ... handler runs for 30 seconds ...
   [Stop clicked — bypass: direct mutations, NO snapshot]
Snapshot 3: markSuccess(userMessage)      [Success]
```

**Problem**: Stop click creates NO MST snapshot because it bypasses IntentBus entirely. DevTool cannot see when Stop was clicked.

### After (Fiber with priority preemption)

```
Snapshot 1: createIntent(userMessage)        [Queued]
Snapshot 2: dispatchIntent(userMessage)      [Processing]
Snapshot 3: createIntent(cancelTask)         [Queued]  ← user clicked Stop
Snapshot 4: suspendIntent(userMessage)       [Suspended]
Snapshot 5: dispatchIntent(cancelTask)       [Processing]
Snapshot 6: markSuccess(cancelTask)          [Success]
Snapshot 7: resumeIntent(userMessage)        [Processing]
   ... handler resumes, detects abort ...
Snapshot 8: markSuccess(userMessage)         [Success]
```

**Benefit**: DevTool now sees the exact moment Stop was clicked (snapshot 3), the preemption (snapshot 4), the cancel execution (snapshots 5-6), and the resume (snapshot 7). Full audit trail of the cancel flow.

---

## Verification After Migration

### Test Scenarios

1. **Send message → Stop → no infinite loop**

    - Send "hi"
    - Click Stop
    - Confirm: no new tool call attempts, UI recovers

2. **Send message → Stop → send new message**

    - Send "hi"
    - Click Stop
    - Send "hi" again
    - Confirm: message appears in chat, generation starts

3. **Cancel during streaming**

    - Send message that triggers streaming
    - Click Stop during streaming
    - Confirm: stream stops, partial message finalized

4. **Cancel during tool execution**

    - Send message that triggers MCP tool
    - Click Stop during tool wait
    - Confirm: tool execution stops (if cancellable) or completes but no new tool started

5. **Multiple rapid Stop clicks**

    - Send message
    - Click Stop rapidly 3 times
    - Confirm: no duplicate cancel behavior, no errors

6. **Stop → New Chat → send message**
    - Send message → Stop
    - Click New Chat
    - Send message
    - Confirm: works normally

### Validation Points

- **Backend DebugMCP**: Check `intentStore.intents` — confirm cancel intent has `priority: 0` (Critical), user message shows `Suspended → Processing → Success` transition
- **DevTool store state**: `get_store_state` for IntentStore — confirm cancel intent is tracked with correct priority
- **DevTool DOM**: `find_element` — confirm UI shows no infinite loop, chat recovers after Stop
