import { types, Instance, getRoot } from "mobx-state-tree"

import type { ClineAskResponse } from "@jabberwock/types"

import type { IRootStore } from "@src/features/store"

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

	function respond(response: ClineAskResponse, text?: string, images?: string[]) {
		getRootStore().chat.respondToAsk(response, text, images)
	}

	return {
		// ── Primary click handlers ──────────────────────────────
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

		// ── Secondary click handlers ────────────────────────────
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

import { vscode } from "@jabberwock/devtool/react"
import type { WebviewMessage } from "@jabberwock/types"
import {
	CHAT_NOTIFICATIONS_CANCEL_AUTO_APPROVAL,
	CHAT_NOTIFICATIONS_CHECKPOINT_DIFF,
	CHAT_NOTIFICATIONS_CHECKPOINT_RESTORE,
	CHAT_NOTIFICATIONS_EDIT_QUEUED_MESSAGE,
	CHAT_NOTIFICATIONS_ELICITATION_RESPONSE,
	CHAT_NOTIFICATIONS_LAST_MESSAGE_SEEN,
	CHAT_NOTIFICATIONS_QUEUE_MESSAGE,
	CHAT_NOTIFICATIONS_REMOVE_QUEUED_MESSAGE,
	CHAT_NOTIFICATIONS_STOP_TTS,
	CLOUD_FOLLOW_UP_ANSWERED,
	SETTINGS_SHOW_MDM_AUTH_REQUIRED_NOTIFICATION,
} from "@jabberwock/types"

/**
 * Creates notification-related actions for the ChatStore.
 * These handle message queuing, checkpoints, TTS, and other notification flows.
 */
export function createNotificationsActions(self: {
	ui: {
		clearInput(): void
	}
}) {
	return {
		// ── Queue message ──────────────────────────────────────────
		queueMessage(text: string, images: string[]) {
			vscode.postMessage({
				type: CHAT_NOTIFICATIONS_QUEUE_MESSAGE,
				text,
				images,
			} satisfies WebviewMessage)
			self.ui.clearInput()
		},

		// ── Remove queued message ──────────────────────────────────
		removeQueuedMessage(id: string) {
			vscode.postMessage({
				type: CHAT_NOTIFICATIONS_REMOVE_QUEUED_MESSAGE,
				messageTs: Number(id),
			} satisfies WebviewMessage)
		},

		// ── Edit queued message ────────────────────────────────────
		editQueuedMessage(id: string, text: string, images?: string[]) {
			vscode.postMessage({
				type: CHAT_NOTIFICATIONS_EDIT_QUEUED_MESSAGE,
				messageTs: Number(id),
				editedMessageContent: text,
				images,
			} satisfies WebviewMessage)
		},

		// ── Cancel auto-approval ───────────────────────────────────
		cancelAutoApproval() {
			vscode.postMessage({
				type: CHAT_NOTIFICATIONS_CANCEL_AUTO_APPROVAL,
			} satisfies WebviewMessage)
		},

		// ── Stop TTS ───────────────────────────────────────────────
		stopTts() {
			vscode.postMessage({
				type: CHAT_NOTIFICATIONS_STOP_TTS,
			} satisfies WebviewMessage)
		},

		// ── Acknowledge last message seen ──────────────────────────
		acknowledgeLastMessageSeen(ts: string) {
			vscode.postMessage({
				type: CHAT_NOTIFICATIONS_LAST_MESSAGE_SEEN,
				text: ts,
			} satisfies WebviewMessage)
		},

		// ── Elicit response ────────────────────────────────────────
		elicitResponse(values: Record<string, unknown>) {
			vscode.postMessage({
				type: CHAT_NOTIFICATIONS_ELICITATION_RESPONSE,
				values,
			} satisfies WebviewMessage)
		},

		// ── Checkpoint diff ────────────────────────────────────────
		checkpointDiff(payload: {
			ts: number
			commitHash: string
			previousCommitHash?: string
			mode: "checkpoint" | "full" | "from-init" | "to-current"
		}) {
			vscode.postMessage({
				type: CHAT_NOTIFICATIONS_CHECKPOINT_DIFF,
				payload,
			} satisfies WebviewMessage)
		},

		// ── Checkpoint restore ─────────────────────────────────────
		checkpointRestore(payload: { ts: number; commitHash: string; mode: "preview" | "restore" }) {
			vscode.postMessage({
				type: CHAT_NOTIFICATIONS_CHECKPOINT_RESTORE,
				payload,
			} satisfies WebviewMessage)
		},

		// ── Follow-up answered ─────────────────────────────────────
		followUpAnswered(ts: number) {
			vscode.postMessage({
				type: CLOUD_FOLLOW_UP_ANSWERED,
				text: String(ts),
			} satisfies WebviewMessage)
		},

		// ── Show MDM auth notification ─────────────────────────────
		showMdmAuthNotification() {
			vscode.postMessage({
				type: SETTINGS_SHOW_MDM_AUTH_REQUIRED_NOTIFICATION,
			} satisfies WebviewMessage)
		},
	}
}
