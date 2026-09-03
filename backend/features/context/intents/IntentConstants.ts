/**
 * ICG-C2 intent registration table for the context scope - pins every request/broadcast constant to its intended Fiber IntentBus bucket (v4 chapter 5 buckets: Critical=0 High=1 Normal=2 Low=3).
 * Response frames are deliberately absent [D-response-targeting]: they ride targeted backend-to-frontend responses and never enter the bus queue.
 */

import { contextEventNames } from "@jabberwock/types"

export const INTENT_PRIORITY: Partial<Record<string, number>> = {
	[contextEventNames.compressRequested]: 3, // Low - background compression work (GIVEN compressor trigger path).
	[contextEventNames.compressCompleted]: 2, // Normal broadcast (manifest swap + UI update).
	[contextEventNames.recallRequested]: 1, // High - the model waits on the tool result in the turn-critical path.
	[contextEventNames.searchRequested]: 1, // High - same class as tool.execution.required.
	[contextEventNames.describeRequested]: 1, // High - describe->recall two-step targeting step.
	[contextEventNames.windowEvicted]: 3, // Low - metadata-only eviction from MST (RAM hygiene).
	[contextEventNames.historyRangeRequested]: 2, // Normal [ICG-C2 new] - viewport fetches must never block newer content or model recall.
	[contextEventNames.nodeUpdatedBroadcast]: 2, // Normal broadcast (incremental patches to loaded rows/nodes).
	[contextEventNames.windowManifestChanged]: 2, // Normal broadcast (active-window manifest swap, all clients converge).
	[contextEventNames.compressProgress]: 3, // Low - progress chatter must not preempt tool traffic.
}
