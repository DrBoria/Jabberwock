import { serializeError } from "serialize-error"
import { type CancelReason, IntentType, IntentStatus } from "@jabberwock/types"
import { t } from "@i18n"
import { diagnosticsManager } from "@jabberwock/devtool"
import { abortStream } from "@features/api/handlers/helpers/recover/requestAbortManager"
import { saveMessages } from "@features/chat/task/messages/actions/saveMessages"
import type { StreamHandle } from "@features/chat/task/condense/actions/types"
import type { ApiRequestContext } from "@features/api/handlers/helpers/prepare/prepareApiRequest"

const MAX_RETRY_ATTEMPTS = 3

export async function handleStreamError(
	ctx: ApiRequestContext,
	sh: StreamHandle,
	error: unknown,
	makeUpdateFn: () => void,
): Promise<null> {
	const streamErrorMsg = `[TODO-LOG] [Task] Stream error (taskId: ${ctx.task.taskId}, error: ${error instanceof Error ? (error as Error).message : "unknown"}`
	console.log(streamErrorMsg)
	diagnosticsManager.log(streamErrorMsg, "error")

	if (ctx.task._state.abandoned) {
		return null
	}

	if (ctx.retryAttempt >= MAX_RETRY_ATTEMPTS) {
		console.error(`[Stream] Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached for task ${ctx.taskId}`)
		return null
	}

	const cancelReason: CancelReason = ctx.task._state.abort ? "user_cancelled" : "streaming_failed"
	const rawErrorMessage =
		error instanceof Error
			? ((error as Error).message ?? JSON.stringify(serializeError(error), null, 2))
			: JSON.stringify(serializeError(error), null, 2)
	const streamingFailedMessage = ctx.task._state.abort
		? undefined
		: `${t("common:interruption.streamTerminatedByProvider", { rawErrorMessage })} ${rawErrorMessage}`

	await abortStream(sh, cancelReason, streamingFailedMessage, makeUpdateFn, () => saveMessages(ctx.taskId))

	if (ctx.task._state.abort) {
		ctx.task._state.setAbortReason(cancelReason)
		await ctx.delegate.abortTask()
	} else {
		console.error(
			`[Task#${ctx.task.taskId}.${ctx.task.instanceId}] Stream failed, will retry: ${streamingFailedMessage}`,
		)

		ctx.store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: IntentType.UserMessageReceived,
			payload: {
				taskId: ctx.taskId,
				content: ctx.userContent,
				retryAttempt: ctx.retryAttempt + 1,
			},
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
		return null
	}

	return null
}
