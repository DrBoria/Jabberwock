import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { checkoutDiffPayloadSchema } from "@jabberwock/types"
import { checkpointDiff } from "@features/foundation/time-machine/actions/checkpoints"
import type { ITaskModel } from "@features/chat/task/store"

/**
 * Handles notification.checkpoint.diff.requested intent — shows checkpoint diff.
 */
export function registerOnCheckpointDiffRequested(bus: IntentBus): void {
	bus.register(IntentType.NotificationCheckpointDiffRequested, async (intent, ctx) => {
		const result = checkoutDiffPayloadSchema.safeParse(intent.payload)

		if (result.success) {
			const task = ctx.rootStore.chat.activeTask as ITaskModel | undefined
			if (task) {
				checkpointDiff(task, {
					ts: result.data.ts ?? Date.now(),
					mode: result.data.mode,
					commitHash: result.data.commitHash || "",
					previousCommitHash: result.data.previousCommitHash,
				})
			}
		}
	})
}
