import type { NotificationAsk, AskResponseValue, ToolProgressStatus } from "@jabberwock/types"
import { getTask } from "@features/chat"
import { getStore } from "@features/singleton"
import { checkAutoApproval } from "@features/settings"
import { submitAskResponse } from "@features/chat"
import {
	onAskPartialMessage,
	onAskNonPartialMessage,
} from "@features/chat/task/notifications/handlers/ask/on-ask-message-respond"

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

	const taskModel = getStore().chat.tasks.get(taskId)!
	const messages = taskModel.notifications.items

	if (partial !== undefined) {
		onAskPartialMessage(task, taskId, notificationType, type, text, partial, progressStatus, isProtected, messages)
	} else {
		onAskNonPartialMessage(task, taskId, notificationType, type, text, isProtected)
	}

	// The ask promise must exist BEFORE auto-approval can resolve it:
	// `submitAskResponse` resolves `task.askResolve` synchronously
	// (it no longer queues a bus intent, which the blocked dispatch fiber
	// could never process). If the resolver is not registered yet, an
	// auto-approve/deny/timeout answer would be dropped and this fiber would
	// wait forever.
	let askResult: { response: AskResponseValue; text?: string; images?: string[] } | undefined
	const askPromise = new Promise<{ response: AskResponseValue; text?: string; images?: string[] }>((resolve) => {
		task.setAskResolve((result) => {
			askResult = result
			resolve(result)
		})
	})

	const approval = await checkAutoApproval({ state: undefined, ask: type, text, isProtected })

	if (approval.decision === "approve") {
		submitAskResponse(taskId, "yesButtonClicked")
	} else if (approval.decision === "deny") {
		submitAskResponse(taskId, "noButtonClicked")
	} else if (approval.decision === "timeout") {
		const timeoutRef = setTimeout(() => {
			const { askResponse, text: approvalText, images } = approval.fn()

			submitAskResponse(taskId, askResponse, approvalText, images)
			task.setAutoApprovalTimeoutRef(undefined)
		}, approval.timeout)
		task.setAutoApprovalTimeoutRef(timeoutRef)
	} else if (approval.decision === "ask") {
		task.setAskShownAt(Date.now())
	}

	// Auto-approval may have resolved the promise synchronously above.
	if (askResult) {
		return askResult
	}

	return await askPromise
}
