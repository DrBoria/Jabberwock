import type { AskResponseValue } from "@jabberwock/types"
import { findLastIndex } from "@shared/array"
import { getTask } from "@features/chat/task/actions/taskRegistry"
import { getBackendRootStore } from "@features/storeSingleton"
import { checkpointSave } from "@features/foundation/time-machine/actions/checkpoints"
import { updateNotification } from "./updateNotification"
import { saveMessages } from "@features/chat/task/messages/actions/saveMessages"
import { IntentType, IntentStatus } from "@jabberwock/types"

/**
 * Handles the webview's response to an ask.
 *
 * Emits an `ask.response.received` Intent which is handled by the
 * on-ask-response-received handler. This replaces the old pattern of
 * directly resolving promises and mutating state.
 */
export function handleWebviewAskResponse(
	taskId: string,
	askResponse: AskResponseValue,
	text?: string,
	images?: string[],
): void {
	const store = getBackendRootStore()
	if (!store) return

	store.intentStore.createIntent({
		id: crypto.randomUUID(),
		type: IntentType.AskResponseReceived,
		payload: { taskId, response: askResponse, text: text ?? "", images: images ?? [] },
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})
}

/**
 * Core response handling logic — resolves the ask promise, creates checkpoints,
 * and marks asks as answered. Called by the on-ask-response-received handler.
 *
 * @internal Exported for use by the IntentBus handler only.
 */
export const FOLLOW_UP_RESPONSES: ReadonlySet<AskResponseValue> = new Set(["messageResponse", "yesButtonClicked"])
export const TOOL_APPROVAL_RESPONSES: ReadonlySet<AskResponseValue> = new Set(["yesButtonClicked", "noButtonClicked"])
export const TOOL_ASK_TYPES: readonly string[] = ["tool", "command", "use_mcp_server"]

export function isAccidentalFastClick(task: ReturnType<typeof getTask>, askResponse: AskResponseValue): boolean {
	if (askResponse !== "yesButtonClicked") {
		return false
	}

	const shownAt = task.askShownAt
	if (!shownAt) {
		return false
	}

	const timeSinceAsk = Date.now() - shownAt
	if (timeSinceAsk < 500) {
		console.warn(`[jabberwock] [Task] Ignoring accidental fast click (${timeSinceAsk}ms)`)
		return true
	}

	return false
}

export function markFollowUpAsAnswered(taskId: string): void {
	const messages = getBackendRootStore().chat.tasks.get(taskId)!.notifications.items
	const lastFollowUpIndex = findLastIndex(
		messages,
		(msg) => msg.type === "ask" && msg.ask === "followup" && !msg.isAnswered,
	)

	if (lastFollowUpIndex !== -1) {
		messages[lastFollowUpIndex].isAnswered = true
		saveMessages(taskId).catch((error: unknown) => {
			console.error("[jabberwock] Failed to save answered follow-up state:", error)
		})
	}
}

export function markToolApprovalAsAnswered(taskId: string): void {
	const messages = getBackendRootStore().chat.tasks.get(taskId)!.notifications.items
	const lastUnansweredAskIndex = findLastIndex(
		messages,
		(msg) => msg.type === "ask" && TOOL_ASK_TYPES.includes(msg.ask ?? "") && !msg.isAnswered,
	)

	if (lastUnansweredAskIndex !== -1) {
		messages[lastUnansweredAskIndex].isAnswered = true
		void updateNotification(getTask(taskId).taskId, messages[lastUnansweredAskIndex])
		saveMessages(taskId).catch((error) => {
			console.error("[jabberwock] Failed to save answered ask state:", error)
		})
	}
}

export function resolveAskResponse(
	taskId: string,
	askResponse: AskResponseValue,
	text?: string,
	images?: string[],
): void {
	const task = getTask(taskId)

	if (isAccidentalFastClick(task, askResponse)) {
		return
	}
	task.askShownAt = undefined

	cancelAutoApprovalTimeout(taskId)

	if (task.askResolve) {
		task.askResolve({ response: askResponse, text, images })
		task.askResolve = null
	}

	if (askResponse === "messageResponse") {
		void checkpointSave(task, false, true)
	}

	if (FOLLOW_UP_RESPONSES.has(askResponse)) {
		markFollowUpAsAnswered(taskId)
	}

	if (TOOL_APPROVAL_RESPONSES.has(askResponse)) {
		markToolApprovalAsAnswered(taskId)
	}
}

/**
 * Approves the current ask with a "yes" response.
 */
export function approveAsk(taskId: string, { text, images }: { text?: string; images?: string[] } = {}): void {
	handleWebviewAskResponse(taskId, "yesButtonClicked", text, images)
}

/**
 * Denies the current ask with a "no" response.
 */
export function denyAsk(taskId: string, { text, images }: { text?: string; images?: string[] } = {}): void {
	handleWebviewAskResponse(taskId, "noButtonClicked", text, images)
}

/**
 * Supersedes the pending ask by generating a new unique timestamp.
 */
export function supersedePendingAsk(taskId: string): void {
	const task = getTask(taskId)
	task.setLastMessageTs(task.generateUniqueTs())
}

/**
 * Cancels any pending auto-approval timeout for the given task.
 */
export function cancelAutoApprovalTimeout(taskId: string): void {
	const task = getTask(taskId)
	if (task.autoApprovalTimeoutRef) {
		clearTimeout(task.autoApprovalTimeoutRef)
		task.autoApprovalTimeoutRef = undefined
	}
}
