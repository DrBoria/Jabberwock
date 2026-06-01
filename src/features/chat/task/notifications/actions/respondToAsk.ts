import type { AskResponseValue } from "@jabberwock/types"
import type { EventBridge } from "../../../../../features/foundation/webview/EventBridge"
import { findLastIndex } from "../../../../../shared/array"
import { getTask } from "../../../task/actions/taskRegistry"
import { getBackendRootStore } from "@features/storeSingleton"
import { checkpointSave } from "../../../../../features/foundation/time-machine/actions/checkpoints"
import { updateNotification } from "./updateNotification"
import { saveMessages } from "../../../task/messages/actions/persistMessages"
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
export function resolveAskResponse(
	taskId: string,
	askResponse: AskResponseValue,
	text?: string,
	images?: string[],
): void {
	const task = getTask(taskId)

	// Jabberwock: Interruption Engineering - prevent accidental fast clicks
	const shownAt = task.askShownAt
	if (askResponse === "yesButtonClicked" && shownAt) {
		const timeSinceAsk = Date.now() - shownAt
		if (timeSinceAsk < 500) {
			console.warn(`[jabberwock] [Task] Ignoring accidental fast click (${timeSinceAsk}ms)`)
			return
		}
	}
	task.askShownAt = undefined

	// Clear any pending auto-approval timeout when user responds
	cancelAutoApprovalTimeout(taskId)

	// Resolve the pending ask promise (if any)
	if (task.askResolve) {
		task.askResolve({ response: askResponse, text, images })
		task.askResolve = null
	}

	// Create a checkpoint whenever the user sends a message.
	if (askResponse === "messageResponse") {
		void checkpointSave(task, false, true)
	}

	// Mark the last follow-up question as answered
	if (askResponse === "messageResponse" || askResponse === "yesButtonClicked") {
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

	// Mark the last tool-approval ask as answered
	if (askResponse === "yesButtonClicked" || askResponse === "noButtonClicked") {
		const messages = getBackendRootStore().chat.tasks.get(taskId)!.notifications.items
		const lastUnansweredAskIndex = findLastIndex(
			messages,
			(msg) =>
				msg.type === "ask" && ["tool", "command", "use_mcp_server"].includes(msg.ask ?? "") && !msg.isAnswered,
		)
		if (lastUnansweredAskIndex !== -1) {
			messages[lastUnansweredAskIndex].isAnswered = true
			void updateNotification(task.taskId, messages[lastUnansweredAskIndex])
			saveMessages(taskId).catch((error) => {
				console.error("[jabberwock] Failed to save answered ask state:", error)
			})
		}
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
	task.lastMessageTs = task.generateUniqueTs()
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

/**
 * Simulates pressing the primary button in the chat interface.
 * Used by API and external consumers.
 */
export async function pressPrimaryButton(provider: EventBridge): Promise<void> {
	await provider.postMessageToWebview({ type: "invoke", invoke: "primaryButtonClick" })
}

/**
 * Simulates pressing the secondary button in the chat interface.
 * Used by API and external consumers.
 */
export async function pressSecondaryButton(provider: EventBridge): Promise<void> {
	await provider.postMessageToWebview({ type: "invoke", invoke: "secondaryButtonClick" })
}
