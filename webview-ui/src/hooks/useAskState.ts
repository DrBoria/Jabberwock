import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { isStateTreeNode, isAlive } from "mobx-state-tree"
import type { ClineAsk, ClineMessage, ClineSayTool, AudioType } from "@jabberwock/types"
import { findLast } from "@shared/array"
import { combineApiRequests } from "@shared/combineApiRequests"
import { combineCommandSequences } from "@shared/combineCommandSequences"
import { getApiMetrics } from "@shared/getApiMetrics"
import { useAppTranslation } from "@src/i18n/TranslationContext"

export interface AskButtonState {
	clineAsk: ClineAsk | undefined
	enableButtons: boolean
	primaryButtonText: string | undefined
	secondaryButtonText: string | undefined
	sendingDisabled: boolean
}

export interface AskDerivedState {
	isStreaming: boolean
	isFollowUpAutoApprovalPaused: boolean
	apiMetrics: ReturnType<typeof getApiMetrics>
	modifiedMessages: ClineMessage[]
}

export interface AskActions {
	resetAskState: () => void
}

/**
 * Manages ask/say button state based on the last message in the chat.
 *
 * Processes the lastMessage.type === "ask" switch to set button text/visibility,
 * and lastMessage.type === "say" to clear button state when API requests start.
 *
 * @param messages - Raw clineMessages from the extension
 * @param currentTaskItem - Current task item (for subtask detection)
 * @param messageQueue - Queue of pending messages
 * @param playSound - Sound playback function
 * @param inputValue - Current input value (for follow-up pause detection)
 */
export function useAskState(
	messages: ClineMessage[],
	currentTaskItem: { parentTaskId?: string } | undefined,
	messageQueue: { id: string }[],
	playSound: (audioType: AudioType) => void,
	inputValue: string,
): AskButtonState & AskDerivedState & AskActions {
	const { t } = useAppTranslation()

	const [clineAsk, setClineAsk] = useState<ClineAsk | undefined>(undefined)
	const [enableButtons, setEnableButtons] = useState<boolean>(false)
	const [primaryButtonText, setPrimaryButtonText] = useState<string | undefined>(undefined)
	const [secondaryButtonText, setSecondaryButtonText] = useState<string | undefined>(undefined)
	const [sendingDisabled, setSendingDisabled] = useState(false)

	const clineAskRef = useRef(clineAsk)
	useEffect(() => {
		clineAskRef.current = clineAsk
	}, [clineAsk])

	const lastMessage = useMemo(() => messages.at(-1), [messages])
	const secondLastMessage = useMemo(() => messages.at(-2), [messages])

	// ── Process lastMessage to set ask/say button state ──
	useEffect(() => {
		if (!lastMessage) return

		if (lastMessage.type === "ask") {
			const isPartial = lastMessage.partial === true
			switch (lastMessage.ask) {
				case "api_req_failed":
					playSound("progress_loop")
					setSendingDisabled(true)
					setClineAsk("api_req_failed")
					setEnableButtons(true)
					setPrimaryButtonText(t("chat:retry.title"))
					setSecondaryButtonText(t("chat:startNewTask.title"))
					break
				case "mistake_limit_reached":
					playSound("progress_loop")
					setSendingDisabled(false)
					setClineAsk("mistake_limit_reached")
					setEnableButtons(true)
					setPrimaryButtonText(t("chat:proceedAnyways.title"))
					setSecondaryButtonText(t("chat:startNewTask.title"))
					break
				case "followup":
					setSendingDisabled(isPartial)
					setClineAsk("followup")
					setEnableButtons(true)
					setPrimaryButtonText(undefined)
					setSecondaryButtonText(undefined)
					break
				case "tool": {
					setSendingDisabled(isPartial)
					setClineAsk("tool")
					setEnableButtons(!isPartial)
					const tool = JSON.parse(lastMessage.text || "{}") as ClineSayTool
					switch (tool.tool) {
						case "editedExistingFile":
						case "appliedDiff":
						case "newFileCreated":
							if (tool.batchDiffs && Array.isArray(tool.batchDiffs)) {
								setPrimaryButtonText(t("chat:edit-batch.approve.title"))
								setSecondaryButtonText(t("chat:edit-batch.deny.title"))
							} else {
								setPrimaryButtonText(t("chat:save.title"))
								setSecondaryButtonText(t("chat:reject.title"))
							}
							break
						case "generateImage":
							setPrimaryButtonText(t("chat:save.title"))
							setSecondaryButtonText(t("chat:reject.title"))
							break
						case "finishTask":
							setPrimaryButtonText(t("chat:completeSubtaskAndReturn"))
							setSecondaryButtonText(undefined)
							break
						case "readFile":
							if (tool.batchFiles && Array.isArray(tool.batchFiles)) {
								setPrimaryButtonText(t("chat:read-batch.approve.title"))
								setSecondaryButtonText(t("chat:read-batch.deny.title"))
							} else {
								setPrimaryButtonText(t("chat:approve.title"))
								setSecondaryButtonText(t("chat:reject.title"))
							}
							break
						case "listFilesTopLevel":
						case "listFilesRecursive":
							if (tool.batchDirs && Array.isArray(tool.batchDirs)) {
								setPrimaryButtonText(t("chat:list-batch.approve.title"))
								setSecondaryButtonText(t("chat:list-batch.deny.title"))
							} else {
								setPrimaryButtonText(t("chat:approve.title"))
								setSecondaryButtonText(t("chat:reject.title"))
							}
							break
						default:
							setPrimaryButtonText(t("chat:approve.title"))
							setSecondaryButtonText(t("chat:reject.title"))
							break
					}
					break
				}
				case "command":
					setSendingDisabled(isPartial)
					setClineAsk("command")
					setEnableButtons(!isPartial)
					setPrimaryButtonText(t("chat:runCommand.title"))
					setSecondaryButtonText(t("chat:reject.title"))
					break
				case "command_output":
					setSendingDisabled(false)
					setClineAsk("command_output")
					setEnableButtons(true)
					setPrimaryButtonText(t("chat:proceedWhileRunning.title"))
					setSecondaryButtonText(t("chat:killCommand.title"))
					break
				case "use_mcp_server":
					setSendingDisabled(isPartial)
					setClineAsk("use_mcp_server")
					setEnableButtons(!isPartial)
					setPrimaryButtonText(t("chat:approve.title"))
					setSecondaryButtonText(t("chat:reject.title"))
					break
				case "interactive_app":
					setSendingDisabled(isPartial)
					setClineAsk("interactive_app")
					setEnableButtons(false)
					setPrimaryButtonText(undefined)
					setSecondaryButtonText(undefined)
					break
				case "completion_result":
					if (!isPartial && messageQueue.length === 0) {
						playSound("celebration")
					}
					setSendingDisabled(isPartial)
					setClineAsk("completion_result")
					setEnableButtons(!isPartial)
					setPrimaryButtonText(t("chat:startNewTask.title"))
					setSecondaryButtonText(undefined)
					break
				case "resume_task": {
					setSendingDisabled(false)
					setClineAsk("resume_task")
					setEnableButtons(true)
					const isCompletedSubtask =
						currentTaskItem?.parentTaskId &&
						messages.some(
							(msg) =>
								(!isStateTreeNode(msg) || isAlive(msg)) &&
								(msg.ask === "completion_result" || msg.say === "completion_result"),
						)
					setPrimaryButtonText(isCompletedSubtask ? t("chat:startNewTask.title") : t("chat:resumeTask.title"))
					setSecondaryButtonText(isCompletedSubtask ? undefined : t("chat:terminate.title"))
					break
				}
				case "resume_completed_task":
					setSendingDisabled(false)
					setClineAsk("resume_completed_task")
					setEnableButtons(true)
					setPrimaryButtonText(t("chat:startNewTask.title"))
					setSecondaryButtonText(undefined)
					break
			}
		} else if (lastMessage.type === "say") {
			switch (lastMessage.say) {
				case "api_req_retry_delayed":
				case "api_req_rate_limit_wait":
					setSendingDisabled(true)
					break
				case "api_req_started":
					setSendingDisabled(true)
					setClineAsk(undefined)
					setEnableButtons(false)
					setPrimaryButtonText(undefined)
					setSecondaryButtonText(undefined)
					break
			}
		}
	}, [lastMessage, secondLastMessage, currentTaskItem?.parentTaskId, messageQueue.length, messages, playSound, t])

	// Update button text for resume_task when messages change
	useEffect(() => {
		if (clineAsk === "resume_task" && currentTaskItem?.parentTaskId) {
			const hasCompletionResult = messages.some(
				(msg) => msg.ask === "completion_result" || msg.say === "completion_result",
			)
			if (hasCompletionResult) {
				setPrimaryButtonText(t("chat:startNewTask.title"))
				setSecondaryButtonText(undefined)
			}
		}
	}, [clineAsk, currentTaskItem?.parentTaskId, messages, t])

	// Reset state when messages are cleared
	useEffect(() => {
		if (messages.length === 0) {
			setSendingDisabled(false)
			setClineAsk(undefined)
			setEnableButtons(false)
			setPrimaryButtonText(undefined)
			setSecondaryButtonText(undefined)
		}
	}, [messages.length])

	const resetAskState = useCallback(() => {
		setSendingDisabled(false)
		setClineAsk(undefined)
		setEnableButtons(false)
		setPrimaryButtonText(undefined)
		setSecondaryButtonText(undefined)
	}, [])

	// ── Derived state ──
	const modifiedMessages = useMemo(() => combineApiRequests(combineCommandSequences(messages.slice(1))), [messages])
	const apiMetrics = useMemo(() => getApiMetrics(modifiedMessages), [modifiedMessages])

	const isStreaming = useMemo(() => {
		const isLastAsk = !!modifiedMessages.at(-1)?.ask
		const isToolCurrentlyAsking =
			isLastAsk &&
			clineAsk !== undefined &&
			((enableButtons && primaryButtonText !== undefined) || clineAsk === "interactive_app")
		if (isToolCurrentlyAsking) return false

		const isLastMessagePartial = modifiedMessages.at(-1)?.partial === true
		if (isLastMessagePartial) return true

		const lastApiReqStarted = findLast(
			modifiedMessages,
			(message: ClineMessage) => message.say === "api_req_started",
		)
		if (lastApiReqStarted && lastApiReqStarted.text !== null && lastApiReqStarted.text !== undefined) {
			try {
				const cost = JSON.parse(lastApiReqStarted.text).cost
				if (cost === undefined) return true
			} catch {
				return true
			}
		}
		return false
	}, [modifiedMessages, clineAsk, enableButtons, primaryButtonText])

	const isFollowUpAutoApprovalPaused = useMemo(
		() => !!(inputValue && inputValue.trim().length > 0 && clineAsk === "followup"),
		[inputValue, clineAsk],
	)

	return {
		clineAsk,
		enableButtons,
		primaryButtonText,
		secondaryButtonText,
		sendingDisabled,
		isStreaming,
		isFollowUpAutoApprovalPaused,
		apiMetrics,
		modifiedMessages,
		resetAskState,
	}
}
