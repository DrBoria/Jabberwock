# MST Snapshot Compatibility with Fiber-Style IntentBus

## Current Architecture (MST Snapshot Boundaries)

Every MST action creates a snapshot checkpoint visible in the DevTool timeline.
Current snapshots per intent lifecycle:

| Step             | MST Action                                | Snapshot |
| ---------------- | ----------------------------------------- | -------- |
| Enqueue          | `intentStore.createIntent(...)`           | ✅ Yes   |
| Start processing | `intentStore.setProcessing(id)`           | ✅ Yes   |
| Handler runs     | `await handler(...)` — no MST action      | ❌ No    |
| Success          | `intentStore.markSuccess(id)`             | ✅ Yes   |
| Failure          | `intentStore.failIntent(id)`              | ✅ Yes   |
| Error recovery   | `intentStore.createIntent(SystemFailure)` | ✅ Yes   |

The MobX `reaction()` callback is NOT an MST action — it's a MobX side-effect.
MST actions are called _from inside_ the reaction callback. DevTool sees them.

## Fiber Architecture (MST Snapshots Preserved)

The scheduler does NOT bypass MST. It decides WHEN to call which MST action.

| Step            | MST Action                                                   | Snapshot |
| --------------- | ------------------------------------------------------------ | -------- |
| Enqueue         | `intentStore.createIntent(...)`                              | ✅ Same  |
| Scheduler picks | `intentStore.dispatchIntent(id)` — single MST action         | ✅ New   |
| Set processing  | inside dispatchIntent                                        | ✅ Same  |
| Handler starts  | `await handler(...)`                                         | ❌ No    |
| Yield           | optional MST action if preempted                             | ✅ New   |
| Preempt/resume  | `intentStore.suspendIntent()` / `intentStore.resumeIntent()` | ✅ New   |
| Success         | `intentStore.markSuccess(id)`                                | ✅ Same  |
| Failure         | `intentStore.failIntent(id)`                                 | ✅ Same  |

## Key Insight

The `reaction()` currently conflates observation + dispatch. In Fiber version:

- `reaction()` → ONLY observation (feeds priority queue)
- Scheduler → calls MST actions (all snapshots preserved)

The scheduler is just a smarter "when to call which MST action" engine.
