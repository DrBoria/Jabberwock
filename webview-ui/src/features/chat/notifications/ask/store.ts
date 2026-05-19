import { types, Instance, getParent } from "mobx-state-tree"

import type { ClineMessage, ClineSayTool, AudioType } from "@jabberwock/types"
import { findLast } from "@shared/array"
import { combineApiRequests } from "@shared/combineApiRequests"
import { combineCommandSequences } from "@shared/combineCommandSequences"

import { getApiMetrics } from "@shared/getApiMetrics"
import type { IChatStore, IChatUIStore } from "../../store"

/**
 * AskStore — manages ask/say button state based on the last chat message.
 *
 * This replaces the React `useAskState` hook, moving all state into MobX.
 * The store processes messages and directly writes to the parent ChatUIStore,
 * eliminating the React → MobX sync bridge that was the root cause of the
 * "New Task" button race condition.
 *
 * HOW IT WORKS:
 *   The ChatArea component calls `processAskMessage()` in a useEffect whenever
 *   messages/currentTaskItem/messageQueue change. This action:
 *   1. Reads the last message
 *   2. Sets button state (clineAsk, enableButtons, primaryButtonText, etc.)
 *      directly on ChatUIStore via getRoot().
 *   3. Computes derived state (isStreaming, isFollowUpAutoApprovalPaused, apiMetrics)
 *      and writes those to ChatUIStore too.
 *   4. Returns an optional AudioType for the component to play sound.
 *
 *   Consumers (ChatArea, ChatView, AskResponder) read ask state directly
 *   from ChatUIStore's observable fields. Since ChatUIStore is MobX-observable,
 *   observer()-wrapped components re-render automatically.
 */

// ── Helpers (extracted from useAskState) ────────────────────────────────

/**
 * Determines whether the task is currently streaming (actively processing).
 */
function computeIsStreaming(
	modifiedMessages: ClineMessage[],
	clineAsk: string,
	enableButtons: boolean,
	primaryButtonText: string,
	currentTaskItem: { parentTaskId?: string } | undefined,
): boolean {
	if (!currentTaskItem) return false

	// Check for orphan/unfinished API requests FIRST
	const lastApiReqStarted = findLast(modifiedMessages, (message: ClineMessage) => message.say === "api_req_started")
	if (lastApiReqStarted && lastApiReqStarted.text !== null && lastApiReqStarted.text !== undefined) {
		try {
			const cost = JSON.parse(lastApiReqStarted.text).cost
			if (cost === undefined) return true
		} catch {
			return true
		}
	}

	// Only after confirming no orphan API requests, check tool-asking state
	const isLastAsk = !!modifiedMessages.at(-1)?.ask
	const isToolCurrentlyAsking =
		isLastAsk && clineAsk !== "" && ((enableButtons && primaryButtonText !== "") || clineAsk === "interactive_app")
	if (isToolCurrentlyAsking) return false

	const isLastMessagePartial = modifiedMessages.at(-1)?.partial === true
	if (isLastMessagePartial) return true

	return false
}

/**
 * Computes modified messages (combined API requests + command sequences).
 */
function computeModifiedMessages(messages: ClineMessage[]): ClineMessage[] {
	return combineApiRequests(combineCommandSequences(messages.slice(1)))
}

// ── Store model ─────────────────────────────────────────────────────────

/**
 * AskStore — empty model, all state lives on ChatUIStore.
 * Actions use getRoot() to access and mutate the parent store.
 */
export const AskStore = types.model("AskStore", {}).actions((self) => {
	function getUI(): IChatUIStore {
		return (getParent(self) as IChatStore).ui
	}

	/**
	 * Extracts button labels for a tool-based ask message.
	 * Pure helper — no state mutation, no effect.
	 */
	function getToolButtonLabels(
		tool: ClineSayTool,
		t: (key: string, options?: Record<string, unknown>) => string,
	): { primary: string; secondary: string } {
		switch (tool.tool) {
			case "editedExistingFile":
			case "appliedDiff":
			case "newFileCreated":
				if (tool.batchDiffs && Array.isArray(tool.batchDiffs)) {
					return {
						primary: t("chat:edit-batch.approve.title"),
						secondary: t("chat:edit-batch.deny.title"),
					}
				}
				return {
					primary: t("chat:save.title"),
					secondary: t("chat:reject.title"),
				}
			case "generateImage":
				return {
					primary: t("chat:save.title"),
					secondary: t("chat:reject.title"),
				}
			case "finishTask":
				return {
					primary: t("chat:completeSubtaskAndReturn"),
					secondary: "",
				}
			case "readFile":
				if (tool.batchFiles && Array.isArray(tool.batchFiles)) {
					return {
						primary: t("chat:read-batch.approve.title"),
						secondary: t("chat:read-batch.deny.title"),
					}
				}
				return {
					primary: t("chat:approve.title"),
					secondary: t("chat:reject.title"),
				}
			case "listFilesTopLevel":
			case "listFilesRecursive":
				if (tool.batchDirs && Array.isArray(tool.batchDirs)) {
					return {
						primary: t("chat:list-batch.approve.title"),
						secondary: t("chat:list-batch.deny.title"),
					}
				}
				return {
					primary: t("chat:approve.title"),
					secondary: t("chat:reject.title"),
				}
			default:
				return {
					primary: t("chat:approve.title"),
					secondary: t("chat:reject.title"),
				}
		}
	}

	// ── Named ask-handler actions (each visible individually in DevTools) ──

	function handleApiReqFailedAsk(
		t: (key: string, options?: Record<string, unknown>) => string,
	): AudioType | undefined {
		const ui = getUI()
		ui.setSendingDisabled(true)
		ui.setClineAsk("api_req_failed")
		ui.setEnableButtons(true)
		ui.setPrimaryButtonText(t("chat:retry.title"))
		ui.setSecondaryButtonText(t("chat:startNewTask.title"))
		return "progress_loop"
	}

	function handleMistakeLimitReachedAsk(
		t: (key: string, options?: Record<string, unknown>) => string,
	): AudioType | undefined {
		const ui = getUI()
		ui.setSendingDisabled(false)
		ui.setClineAsk("mistake_limit_reached")
		ui.setEnableButtons(true)
		ui.setPrimaryButtonText(t("chat:proceedAnyways.title"))
		ui.setSecondaryButtonText(t("chat:startNewTask.title"))
		return "progress_loop"
	}

	function handleFollowUpAsk(
		isPartial: boolean,
		_t: (key: string, options?: Record<string, unknown>) => string,
	): AudioType | undefined {
		const ui = getUI()
		ui.setSendingDisabled(isPartial)
		ui.setClineAsk("followup")
		ui.setEnableButtons(true)
		ui.setPrimaryButtonText("")
		ui.setSecondaryButtonText("")
		return undefined
	}

	function handleToolAsk(
		isPartial: boolean,
		lastMessage: ClineMessage,
		t: (key: string, options?: Record<string, unknown>) => string,
	): AudioType | undefined {
		const ui = getUI()
		ui.setSendingDisabled(isPartial)
		ui.setClineAsk("tool")
		ui.setEnableButtons(!isPartial)
		try {
			const tool = JSON.parse(lastMessage.text || "{}") as ClineSayTool
			const { primary, secondary } = getToolButtonLabels(tool, t)
			ui.setPrimaryButtonText(primary)
			ui.setSecondaryButtonText(secondary)
		} catch {
			ui.setPrimaryButtonText(t("chat:approve.title"))
			ui.setSecondaryButtonText(t("chat:reject.title"))
		}
		return undefined
	}

	function handleCommandAsk(
		isPartial: boolean,
		t: (key: string, options?: Record<string, unknown>) => string,
	): AudioType | undefined {
		const ui = getUI()
		ui.setSendingDisabled(isPartial)
		ui.setClineAsk("command")
		ui.setEnableButtons(!isPartial)
		ui.setPrimaryButtonText(t("chat:runCommand.title"))
		ui.setSecondaryButtonText(t("chat:reject.title"))
		return undefined
	}

	function handleCommandOutputAsk(
		t: (key: string, options?: Record<string, unknown>) => string,
	): AudioType | undefined {
		const ui = getUI()
		ui.setSendingDisabled(false)
		ui.setClineAsk("command_output")
		ui.setEnableButtons(true)
		ui.setPrimaryButtonText(t("chat:proceedWhileRunning.title"))
		ui.setSecondaryButtonText(t("chat:killCommand.title"))
		return undefined
	}

	function handleUseMcpServerAsk(
		isPartial: boolean,
		t: (key: string, options?: Record<string, unknown>) => string,
	): AudioType | undefined {
		const ui = getUI()
		ui.setSendingDisabled(isPartial)
		ui.setClineAsk("use_mcp_server")
		ui.setEnableButtons(!isPartial)
		ui.setPrimaryButtonText(t("chat:approve.title"))
		ui.setSecondaryButtonText(t("chat:reject.title"))
		return undefined
	}

	function handleInteractiveAppAsk(isPartial: boolean): AudioType | undefined {
		const ui = getUI()
		ui.setSendingDisabled(isPartial)
		ui.setClineAsk("")
		ui.setEnableButtons(false)
		ui.setPrimaryButtonText("")
		ui.setSecondaryButtonText("")
		return undefined
	}

	function handleCompletionResultAsk(
		isPartial: boolean,
		messageQueue: { id: string }[],
		t: (key: string, options?: Record<string, unknown>) => string,
	): AudioType | undefined {
		const ui = getUI()
		let soundType: AudioType | undefined
		if (!isPartial && messageQueue.length === 0) {
			soundType = "celebration"
		}
		ui.setSendingDisabled(isPartial)
		ui.setClineAsk("completion_result")
		ui.setEnableButtons(!isPartial)
		ui.setPrimaryButtonText(t("chat:startNewTask.title"))
		ui.setSecondaryButtonText("")
		return soundType
	}

	function handleResumeTaskAsk(
		currentTaskItem: { parentTaskId?: string } | undefined,
		messages: ClineMessage[],
		t: (key: string, options?: Record<string, unknown>) => string,
	): AudioType | undefined {
		const ui = getUI()
		ui.setSendingDisabled(false)
		ui.setClineAsk("resume_task")
		ui.setEnableButtons(true)
		const isCompletedSubtask =
			currentTaskItem?.parentTaskId &&
			messages.some((msg) => msg.ask === "completion_result" || msg.say === "completion_result")
		ui.setPrimaryButtonText(isCompletedSubtask ? t("chat:startNewTask.title") : t("chat:resumeTask.title"))
		ui.setSecondaryButtonText(isCompletedSubtask ? "" : t("chat:terminate.title"))
		return undefined
	}

	function handleResumeCompletedTaskAsk(
		t: (key: string, options?: Record<string, unknown>) => string,
	): AudioType | undefined {
		const ui = getUI()
		ui.setSendingDisabled(false)
		ui.setClineAsk("resume_completed_task")
		ui.setEnableButtons(true)
		ui.setPrimaryButtonText(t("chat:startNewTask.title"))
		ui.setSecondaryButtonText("")
		return undefined
	}

	function handleSayMessage(lastMessage: ClineMessage): void {
		const ui = getUI()
		switch (lastMessage.say) {
			case "api_req_retry_delayed":
			case "api_req_rate_limit_wait":
				ui.setSendingDisabled(true)
				break
			case "api_req_started":
				ui.setSendingDisabled(true)
				ui.setClineAsk("")
				ui.setEnableButtons(false)
				ui.setPrimaryButtonText("")
				ui.setSecondaryButtonText("")
				break
		}
	}

	return {
		/**
		 * Process the last message and update ask button state on ChatUIStore.
		 * Called from ChatArea's useEffect whenever messages/context change.
		 *
		 * Dispatches to individual named handler actions so each state change
		 * appears as a separate entry in DevTool action logs.
		 *
		 * @returns AudioType to play, or undefined if no sound is needed.
		 */
		processAskMessage(
			messages: ClineMessage[],
			currentTaskItem: { id?: string; parentTaskId?: string; ts?: number } | undefined,
			messageQueue: { id: string }[],
			inputValue: string,
			t: (key: string, options?: Record<string, unknown>) => string,
		): AudioType | undefined {
			const lastMessage = messages.at(-1)
			const ui = getUI()

			if (!lastMessage) return undefined

			let soundType: AudioType | undefined

			// If the last ask was already answered, don't re-show buttons
			if (lastMessage.type === "ask" && lastMessage.isAnswered) {
				ui.setClineAsk("")
				ui.setEnableButtons(false)
				ui.setPrimaryButtonText("")
				ui.setSecondaryButtonText("")
			} else if (lastMessage.type === "ask") {
				const isPartial = lastMessage.partial === true

				switch (lastMessage.ask) {
					case "api_req_failed":
						soundType = handleApiReqFailedAsk(t)
						break
					case "mistake_limit_reached":
						soundType = handleMistakeLimitReachedAsk(t)
						break
					case "followup":
						soundType = handleFollowUpAsk(isPartial, t)
						break
					case "tool":
						soundType = handleToolAsk(isPartial, lastMessage, t)
						break
					case "command":
						soundType = handleCommandAsk(isPartial, t)
						break
					case "command_output":
						soundType = handleCommandOutputAsk(t)
						break
					case "use_mcp_server":
						soundType = handleUseMcpServerAsk(isPartial, t)
						break
					case "interactive_app":
						soundType = handleInteractiveAppAsk(isPartial)
						break
					case "completion_result":
						soundType = handleCompletionResultAsk(isPartial, messageQueue, t)
						break
					case "resume_task":
						soundType = handleResumeTaskAsk(currentTaskItem, messages, t)
						break
					case "resume_completed_task":
						soundType = handleResumeCompletedTaskAsk(t)
						break
				}
			} else if (lastMessage.type === "say") {
				handleSayMessage(lastMessage)
			}

			// ── Compute derived state ──
			const modifiedMessages = computeModifiedMessages(messages)

			// isStreaming
			const streaming = computeIsStreaming(
				modifiedMessages,
				ui.clineAsk,
				ui.enableButtons,
				ui.primaryButtonText,
				currentTaskItem,
			)
			ui.setIsStreaming(streaming)

			// isFollowUpAutoApprovalPaused
			ui.setIsFollowUpAutoApprovalPaused(
				!!(inputValue && inputValue.trim().length > 0 && ui.clineAsk === "followup"),
			)

			// apiMetrics
			ui.setApiMetrics(getApiMetrics(modifiedMessages))

			return soundType
		},

		handleApiReqFailedAsk,
		handleMistakeLimitReachedAsk,
		handleFollowUpAsk,
		handleToolAsk,
		handleCommandAsk,
		handleCommandOutputAsk,
		handleUseMcpServerAsk,
		handleInteractiveAppAsk,
		handleCompletionResultAsk,
		handleResumeTaskAsk,
		handleResumeCompletedTaskAsk,
		handleSayMessage,

		/**
		 * Update button text for resume_task when new messages arrive.
		 * Called separately from processAskMessage because it depends on clineAsk
		 * being already set (e.g. after messages.length > 0 triggers a re-process).
		 */
		updateResumeTaskButton(
			messages: ClineMessage[],
			currentTaskItem: { parentTaskId?: string } | undefined,
			t: (key: string, options?: Record<string, unknown>) => string,
		) {
			const ui = getUI()
			if (ui.clineAsk === "resume_task" && currentTaskItem?.parentTaskId) {
				const hasCompletionResult = messages.some(
					(msg) => msg.ask === "completion_result" || msg.say === "completion_result",
				)
				if (hasCompletionResult) {
					ui.setPrimaryButtonText(t("chat:startNewTask.title"))
					ui.setSecondaryButtonText("")
				}
			}
		},

		/**
		 * Reset all ask button state to defaults.
		 * Does NOT reset isStreaming — it's derived from messages and recomputed
		 * on the next processAskMessage call.
		 */
		resetAskState() {
			const ui = getUI()
			ui.setClineAsk("")
			ui.setEnableButtons(false)
			ui.setPrimaryButtonText("")
			ui.setSecondaryButtonText("")
			ui.setSendingDisabled(false)
		},
	}
})

export type IAskStore = Instance<typeof AskStore>
