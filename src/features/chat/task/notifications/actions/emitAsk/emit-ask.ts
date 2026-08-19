import type { NotificationAsk, AskResponseValue, ToolProgressStatus } from "@jabberwock/types"
import { getTask } from "@features/chat/task/actions/taskRegistry"
import { getBackendRootStore } from "@features/storeSingleton"
import { checkAutoApproval } from "@features/settings"
import { handleWebviewAskResponse } from "@features/chat/task/notifications/actions/core/respondToAsk"
import { handleAskPartialMessage, handleAskNonPartialMessage } from "./ask-message-handlers"

export async function emitAsk(
	taskId: string,
	notificationType: string,
	type: NotificationAsk,
	text?: string,
	partial?: boolean,
	progressStatus?: ToolProgressStatus,
	isProtected?: boolean,
): Promise<{ response: AskResponseValue; text?: string; images?: string[] }> {
	const task = getTask(taskId)

	await task.taskModeReady

	if (task._state.abort) {
		throw new Error(`[Jabberwock#ask] task ${task.taskId}.${task.instanceId} aborted`)
	}

	const taskModel = getBackendRootStore().chat.tasks.get(taskId)!
	const messages = taskModel.notifications.items

	if (partial !== undefined) {
		handleAskPartialMessage(
			task,
			taskId,
			notificationType,
			type,
			text,
			partial,
			progressStatus,
			isProtected,
			messages,
		)
	} else {
		handleAskNonPartialMessage(task, taskId, notificationType, type, text, isProtected)
	}

	const approval = await checkAutoApproval({ state: undefined, ask: type, text, isProtected })

	if (approval.decision === "approve") {
		handleWebviewAskResponse(taskId, "yesButtonClicked")
	} else if (approval.decision === "deny") {
		handleWebviewAskResponse(taskId, "noButtonClicked")
	} else if (approval.decision === "timeout") {
		task.autoApprovalTimeoutRef = setTimeout(() => {
			const { askResponse, text: approvalText, images } = approval.fn()

			handleWebviewAskResponse(taskId, askResponse, approvalText, images)
			task.autoApprovalTimeoutRef = undefined
		}, approval.timeout)
	} else if (approval.decision === "ask") {
		task.askShownAt = Date.now()
	}

	const askPromise = new Promise<{ response: AskResponseValue; text?: string; images?: string[] }>((resolve) => {
		task.askResolve = resolve
	})

	return await askPromise
}
