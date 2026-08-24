import { types, Instance, getRoot } from "mobx-state-tree"

import type { AskResponseValue } from "@jabberwock/types"

import type { IRootStore } from "@src/features/root-store"

/**
 * NotificationsStore — handles all ClineAsk response routing.
 *
 * Each action maps a specific ClineAsk type to a respondToAsk call
 * on the parent ChatStore. This replaces the event-dispatch.ts
 * switch/case pattern with typed MST actions.
 */
export const NotificationsStore = types.model("NotificationsStore", {}).actions((self) => {
	/** Get the RootStore via getRoot for type-safe cross-store calling. */
	function getRootStore(): IRootStore {
		return getRoot(self) as IRootStore
	}

	function respond(response: AskResponseValue, text?: string, images?: string[]) {
		getRootStore().chat.respondToAsk(response, text, images)
	}

	return {
		acknowledgeAskResponse(text?: string, images?: string[]) {
			respond("yesButtonClicked", text, images)
		},

		approveTodoPlan() {
			respond("yesButtonClicked")
		},

		handleApiRequestFailed(text?: string, images?: string[]) {
			respond("yesButtonClicked", text, images)
		},

		handleCommand(text?: string, images?: string[]) {
			respond("yesButtonClicked", text, images)
		},

		handleTool(text?: string, images?: string[]) {
			respond("yesButtonClicked", text, images)
		},

		handleUseMcpServer(text?: string, images?: string[]) {
			respond("yesButtonClicked", text, images)
		},

		handleMistakeLimitReached(text?: string, images?: string[]) {
			respond("yesButtonClicked", text, images)
		},

		handleResumeTask(text?: string, images?: string[]) {
			respond("yesButtonClicked", text, images)
		},

		handleCompletionResult() {
			getRootStore().chat.clearTask()
		},

		handleResumeCompletedTask() {
			getRootStore().chat.clearTask()
		},

		handleCommandOutputContinue() {
			getRootStore().settings.terminalOperation("continue")
		},

		handleCommandOutputAbort() {
			getRootStore().settings.terminalOperation("abort")
		},

		rejectAskResponse(text?: string, images?: string[]) {
			respond("noButtonClicked", text, images)
		},

		handleApiRequestFailedSecondary() {
			getRootStore().chat.clearTask()
		},

		handleMistakeLimitReachedSecondary() {
			getRootStore().chat.clearTask()
		},

		handleResumeTaskSecondary() {
			getRootStore().chat.clearTask()
		},

		handleCommandSecondary(text?: string, images?: string[]) {
			respond("noButtonClicked", text, images)
		},

		handleToolSecondary(text?: string, images?: string[]) {
			respond("noButtonClicked", text, images)
		},

		handleUseMcpServerSecondary(text?: string, images?: string[]) {
			respond("noButtonClicked", text, images)
		},
	}
})

export type INotificationsStore = Instance<typeof NotificationsStore>

// ── Action factory for ChatStore composition ──────────────────────────

import { vscode } from "@jabberwock/devtool/webview"
import type { WebviewMessage } from "@jabberwock/types"
import { eventConstants } from "@jabberwock/types"

/**
 * Creates notification-related actions for the ChatStore.
 * These handle message queuing, checkpoints, TTS, and other notification flows.
 */
export function createNotificationsActions(self: { textArea: { clearInput(): void } }) {
	return {
		queueMessage(text: string, images: string[]) {
			vscode.postMessage({
				type: eventConstants.CHAT.NOTIFICATIONS.QUEUE_MESSAGE,
				text,
				images,
			} satisfies WebviewMessage)
			self.textArea.clearInput()
		},

		removeQueuedMessage(id: string) {
			vscode.postMessage({
				type: eventConstants.CHAT.NOTIFICATIONS.REMOVE_QUEUED_MESSAGE,
				messageTs: Number(id),
			} satisfies WebviewMessage)
		},

		editQueuedMessage(id: string, text: string, images?: string[]) {
			vscode.postMessage({
				type: eventConstants.CHAT.NOTIFICATIONS.EDIT_QUEUED_MESSAGE,
				messageTs: Number(id),
				editedMessageContent: text,
				images,
			} satisfies WebviewMessage)
		},

		cancelAutoApproval() {
			vscode.postMessage({
				type: eventConstants.CHAT.NOTIFICATIONS.CANCEL_AUTO_APPROVAL,
			} satisfies WebviewMessage)
		},

		stopTts() {
			vscode.postMessage({
				type: eventConstants.CHAT.NOTIFICATIONS.STOP_TTS,
			} satisfies WebviewMessage)
		},

		acknowledgeLastMessageSeen(ts: string) {
			vscode.postMessage({
				type: eventConstants.CHAT.NOTIFICATIONS.LAST_MESSAGE_SEEN,
				text: ts,
			} satisfies WebviewMessage)
		},

		elicitResponse(values: Record<string, unknown>) {
			vscode.postMessage({
				type: eventConstants.CHAT.NOTIFICATIONS.ELICITATION_RESPONSE,
				values,
			} satisfies WebviewMessage)
		},

		checkpointDiff(payload: {
			ts: number
			commitHash: string
			previousCommitHash?: string
			mode: "checkpoint" | "full" | "from-init" | "to-current"
		}) {
			vscode.postMessage({
				type: eventConstants.CHAT.NOTIFICATIONS.CHECKPOINT_DIFF,
				payload,
			} satisfies WebviewMessage)
		},

		checkpointRestore(payload: { ts: number; commitHash: string; mode: "preview" | "restore" }) {
			vscode.postMessage({
				type: eventConstants.CHAT.NOTIFICATIONS.CHECKPOINT_RESTORE,
				payload,
			} satisfies WebviewMessage)
		},

		followUpAnswered(ts: number) {
			vscode.postMessage({
				type: eventConstants.CLOUD.FOLLOW_UP_ANSWERED,
				text: String(ts),
			} satisfies WebviewMessage)
		},

		showMdmAuthNotification() {
			vscode.postMessage({
				type: eventConstants.SETTINGS.SHOW_MDM_AUTH_REQUIRED_NOTIFICATION,
			} satisfies WebviewMessage)
		},
	}
}
