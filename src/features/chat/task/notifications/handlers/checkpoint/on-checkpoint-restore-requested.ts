import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { checkoutRestorePayloadSchema } from "@jabberwock/types"
import * as vscode from "vscode"
import { when } from "mobx"
import { t } from "@i18n"
import { checkpointRestore } from "@features/foundation/time-machine/actions/checkpoints"
import type { ITaskModel } from "@features/chat/task/store"

/**
 * Handles notification.checkpoint.restore.requested intent — restores a checkpoint.
 */
export function registerOnCheckpointRestoreRequested(bus: IntentBus): void {
	bus.register(IntentType.NotificationCheckpointRestoreRequested, async (intent, ctx) => {
		const result = checkoutRestorePayloadSchema.safeParse(intent.payload)

		if (result.success) {
			const task = ctx.rootStore.chat.activeTask as ITaskModel | undefined
			task?.abortTask()

			try {
				await when(() => ctx.rootStore.chat.activeTask?.isInitialized === true, { timeout: 3_000 })
			} catch (_error) {
				vscode.window.showErrorMessage(t("common:errors.checkpoint_timeout"))
			}

			try {
				await checkpointRestore(task!, {
					ts: result.data.ts || Date.now(),
					mode: result.data.mode,
					commitHash: result.data.commitHash,
				})
			} catch (_error) {
				vscode.window.showErrorMessage(t("common:errors.checkpoint_failed"))
			}
		}
	})
}
