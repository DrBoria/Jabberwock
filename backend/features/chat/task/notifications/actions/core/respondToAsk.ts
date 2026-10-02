import { runInAction } from "mobx"
import type { AskResponseValue } from "@jabberwock/types"
import { findLastIndex } from "@shared/core/array"
import { getTask } from "@features/chat/task/actions"
import { getStore } from "@features/singleton"
import { checkpointSave } from "@features/foundation"
import { updateNotification } from "./updateNotification"
import { saveMessages } from "@features/chat/task/messages/actions/save"

/**
 * Handles the webview's response to an ask.
 *
 * Resolves the ask synchronously (outside the intent bus). The previous
 * implementation queued an `ask.response.received` intent, but the intent
 * bus dispatches handlers on a single fiber — and that fiber is the one
 * blocked awaiting the ask promise, so the response intent could never be
 * processed: the dialog could not be answered and the task never completed.
 * `emitAsk` now creates the ask promise BEFORE auto-approval can fire this
 * handler, so resolution always finds `task.askResolve`.
 */
export function submitAskResponse(
	taskId: string,
	askResponse: AskResponseValue,
	text?: string,
	images?: string[],
): void {
	const store = getStore()
	if (!store || !taskId) {
		return
	}

	runInAction(() => {
		resolveAskResponse(taskId, askResponse, text ?? "", images ?? [])
	})
}

/**
 * Core response handling logic — resolves the ask promise, creates checkpoints,
 * and marks asks as answered. Called by the on-ask-response-received handler.
 *
 * @internal Exported for use by the IntentBus handler only.
 */
const __moduleState = {
	FOLLOW_UP_RESPONSES: new Set(["messageResponse", "yesButtonClicked"]),
}
export const { FOLLOW_UP_RESPONSES } = __moduleState
export const TOOL_APPROVAL_RESPONSES: ReadonlySet<AskResponseValue> = new Set([
	"yesButtonClicked",
	"noButtonClicked",
]) as ReadonlySet<AskResponseValue>
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
	const messages = getStore().chat.tasks.get(taskId)!.notifications.items
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
	const messages = getStore().chat.tasks.get(taskId)!.notifications.items
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
	task.setAskShownAt(undefined)

	cancelAutoApprovalTimeout(taskId)

	if (task.askResolve) {
		task.askResolve({ response: askResponse, text, images })
	}
	// Always clear the resolver: `emitAsk` returns right after the promise
	// settles and a stray resolver would leak. Clearing unconditionally also
	// makes fast auto-approval / double responses idempotent.
	task.setAskResolve(null)

	if (askResponse === "messageResponse") {
		void checkpointSave(task, false, true)
	}

	if (__moduleState.FOLLOW_UP_RESPONSES.has(askResponse)) {
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
	submitAskResponse(taskId, "yesButtonClicked", text, images)
}

/**
 * Denies the current ask with a "no" response.
 */
export function denyAsk(taskId: string, { text, images }: { text?: string; images?: string[] } = {}): void {
	submitAskResponse(taskId, "noButtonClicked", text, images)
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
		task.setAutoApprovalTimeoutRef(undefined)
	}
}
