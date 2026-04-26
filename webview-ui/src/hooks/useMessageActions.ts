import { useCallback, useRef } from "react"
import type { ClineAsk, ClineMessage } from "@jabberwock/types"
import { isRetiredProvider } from "@jabberwock/types"
import { vscode } from "@src/utils/vscode"

export interface MessageActions {
	handleSendMessage: (text: string, images: string[]) => void
	handlePrimaryButtonClick: (text?: string, images?: string[]) => void
	handleSecondaryButtonClick: (text?: string, images?: string[]) => void
	handleChatReset: (shouldPostMessage?: boolean) => void
	startNewTask: () => void
	markFollowUpAsAnswered: () => void
	handleStopTask: () => void
	handleEnqueueCurrentMessage: (text: string, images: string[]) => void
	handleSetChatBoxMessage: (text: string, images: string[]) => void
	handleSuggestionClick: (
		suggestion: { answer: string; mode?: string; id?: string },
		event: React.MouseEvent | undefined,
		store: { navigateToNode: (id: string) => void },
		alwaysAllowModeSwitch: boolean,
	) => void
	handleBatchFileResponse: (response: { [key: string]: boolean }) => void
	handleFollowUpUnmount: () => void
}

/**
 * Creates message action handlers for ChatView.
 *
 * Pure function — no state, no hooks. Takes all dependencies explicitly.
 * The parent component wires inputValue/selectedImages via the returned handlers.
 */
export function useMessageActions(
	clineAsk: ClineAsk | undefined,
	clineAskRef: React.MutableRefObject<ClineAsk | undefined>,
	sendingDisabled: boolean,
	isStreaming: boolean,
	messageQueue: { id: string }[],
	messages: ClineMessage[],
	currentTaskItem: { parentTaskId?: string; id?: string } | undefined,
	apiConfiguration: { apiProvider?: string } | undefined,
	_onResetState: () => void,
	onSetSendingDisabled: (v: boolean) => void,
	onSetClineAsk: (v: ClineAsk | undefined) => void,
	onSetEnableButtons: (v: boolean) => void,
	onSetPrimaryButtonText: (v: string | undefined) => void,
	onSetSecondaryButtonText: (v: string | undefined) => void,
	onSetInputValue: (v: string) => void,
	onSetSelectedImages: (v: string[]) => void,
): MessageActions {
	const userRespondedRef = useRef(false)

	const markFollowUpAsAnswered = useCallback(() => {
		const lastFollowUp = messages.findLast((msg: ClineMessage) => msg.ask === "followup")
		if (lastFollowUp) {
			// The parent should track followUpTs via a callback
			vscode.postMessage({ type: "followUpAnswered" as any, text: String(lastFollowUp.ts) })
		}
	}, [messages])

	const handleChatReset = useCallback(
		(shouldPostMessage: boolean = true) => {
			onSetSendingDisabled(false)
			onSetClineAsk(undefined)
			onSetEnableButtons(false)
			onSetInputValue("")
			onSetSelectedImages([])
			if (shouldPostMessage) {
				vscode.postMessage({ type: "clearTask" })
			}
		},
		[onSetSendingDisabled, onSetClineAsk, onSetEnableButtons, onSetInputValue, onSetSelectedImages],
	)

	const startNewTask = useCallback(() => {
		onSetInputValue("")
		onSetSelectedImages([])
		vscode.postMessage({ type: "clearTask" })
	}, [onSetInputValue, onSetSelectedImages])

	const handleSendMessage = useCallback(
		(text: string, images: string[]) => {
			text = text.trim()
			if (!text && images.length === 0) return

			if (apiConfiguration?.apiProvider && isRetiredProvider(apiConfiguration.apiProvider)) {
				// Parent should handle showRetiredProviderWarning
				return
			}

			if (sendingDisabled || isStreaming || messageQueue.length > 0 || clineAskRef.current === "command_output") {
				vscode.postMessage({ type: "queueMessage", text, images })
				onSetInputValue("")
				onSetSelectedImages([])
				return
			}

			userRespondedRef.current = true

			if (messages.length === 0) {
				vscode.postMessage({ type: "newTask", text, images })
			} else if (clineAskRef.current) {
				if (clineAskRef.current === "followup") markFollowUpAsAnswered()
				vscode.postMessage({ type: "askResponse", askResponse: "messageResponse", text, images })
			} else {
				vscode.postMessage({ type: "askResponse", askResponse: "messageResponse", text, images })
			}

			handleChatReset(true)
		},
		[
			handleChatReset,
			markFollowUpAsAnswered,
			sendingDisabled,
			isStreaming,
			messageQueue.length,
			messages.length,
			apiConfiguration?.apiProvider,
			clineAskRef,
			onSetInputValue,
			onSetSelectedImages,
		],
	)

	const handlePrimaryButtonClick = useCallback(
		(text?: string, images?: string[]) => {
			userRespondedRef.current = true
			const trimmedInput = text?.trim()

			switch (clineAsk) {
				case "api_req_failed":
				case "command":
				case "tool":
				case "use_mcp_server":
				case "mistake_limit_reached":
					if (trimmedInput || (images && images.length > 0)) {
						vscode.postMessage({
							type: "askResponse",
							askResponse: "yesButtonClicked",
							text: trimmedInput,
							images,
						})
						onSetInputValue("")
						onSetSelectedImages([])
					} else {
						vscode.postMessage({ type: "askResponse", askResponse: "yesButtonClicked" })
					}
					break
				case "resume_task": {
					const isCompletedSubtask =
						currentTaskItem?.parentTaskId &&
						messages.some((msg) => msg.ask === "completion_result" || msg.say === "completion_result")
					if (isCompletedSubtask) {
						startNewTask()
						return
					}
					if (trimmedInput || (images && images.length > 0)) {
						vscode.postMessage({
							type: "askResponse",
							askResponse: "yesButtonClicked",
							text: trimmedInput,
							images,
						})
						onSetInputValue("")
						onSetSelectedImages([])
					} else {
						vscode.postMessage({ type: "askResponse", askResponse: "yesButtonClicked" })
					}
					break
				}
				case "completion_result":
				case "resume_completed_task":
					startNewTask()
					return
				case "command_output":
					vscode.postMessage({ type: "terminalOperation", terminalOperation: "continue" })
					break
			}

			onSetSendingDisabled(true)
			onSetClineAsk(undefined)
			onSetEnableButtons(false)
			onSetPrimaryButtonText(undefined)
			onSetSecondaryButtonText(undefined)
		},
		[
			clineAsk,
			startNewTask,
			currentTaskItem?.parentTaskId,
			messages,
			onSetSendingDisabled,
			onSetClineAsk,
			onSetEnableButtons,
			onSetPrimaryButtonText,
			onSetSecondaryButtonText,
			onSetInputValue,
			onSetSelectedImages,
		],
	)

	const handleSecondaryButtonClick = useCallback(
		(text?: string, images?: string[]) => {
			userRespondedRef.current = true
			const trimmedInput = text?.trim()

			if (isStreaming) {
				vscode.postMessage({ type: "cancelTask" })
				return
			}

			switch (clineAsk) {
				case "api_req_failed":
				case "mistake_limit_reached":
				case "resume_task":
					startNewTask()
					break
				case "command":
				case "tool":
				case "use_mcp_server":
					if (trimmedInput || (images && images.length > 0)) {
						vscode.postMessage({
							type: "askResponse",
							askResponse: "noButtonClicked",
							text: trimmedInput,
							images,
						})
						onSetInputValue("")
						onSetSelectedImages([])
					} else {
						vscode.postMessage({ type: "askResponse", askResponse: "noButtonClicked" })
					}
					break
				case "command_output":
					vscode.postMessage({ type: "terminalOperation", terminalOperation: "abort" })
					break
			}

			onSetSendingDisabled(true)
			onSetClineAsk(undefined)
			onSetEnableButtons(false)
		},
		[
			clineAsk,
			startNewTask,
			isStreaming,
			onSetSendingDisabled,
			onSetClineAsk,
			onSetEnableButtons,
			onSetInputValue,
			onSetSelectedImages,
		],
	)

	const handleStopTask = useCallback(() => {
		vscode.postMessage({ type: "cancelTask" })
	}, [])

	const handleEnqueueCurrentMessage = useCallback(
		(text: string, images: string[]) => {
			if (text.trim() || images.length > 0) {
				vscode.postMessage({ type: "queueMessage", text: text.trim(), images })
				onSetInputValue("")
				onSetSelectedImages([])
			}
		},
		[onSetInputValue, onSetSelectedImages],
	)

	const handleSetChatBoxMessage = useCallback((text: string, images: string[]) => {
		// Parent should handle merging with current inputValue
		vscode.postMessage({ type: "setChatBoxMessage" as any, text, images })
	}, [])

	const handleSuggestionClick = useCallback(
		(
			suggestion: { answer: string; mode?: string; id?: string },
			event: React.MouseEvent | undefined,
			store: { navigateToNode: (id: string) => void },
			alwaysAllowModeSwitch: boolean,
		) => {
			if (event) userRespondedRef.current = true

			if (suggestion.mode) {
				const isManualClick = !!event
				if (isManualClick || alwaysAllowModeSwitch) {
					if (suggestion.id) store.navigateToNode(suggestion.id)
					vscode.postMessage({ type: "showTaskWithId", text: suggestion.id })
				}
			}

			if (event?.shiftKey) {
				// Append to input — parent handles this via setChatBoxMessage
				vscode.postMessage({ type: "setChatBoxMessage" as any, text: suggestion.answer, images: [] })
			} else {
				handleSendMessage(suggestion.answer, [])
			}
		},
		[handleSendMessage],
	)

	const handleBatchFileResponse = useCallback((response: { [key: string]: boolean }) => {
		vscode.postMessage({ type: "askResponse", askResponse: "objectResponse", text: JSON.stringify(response) })
	}, [])

	const handleFollowUpUnmount = useCallback(() => {
		vscode.postMessage({ type: "cancelAutoApproval" })
	}, [])

	return {
		handleSendMessage,
		handlePrimaryButtonClick,
		handleSecondaryButtonClick,
		handleChatReset,
		startNewTask,
		markFollowUpAsAnswered,
		handleStopTask,
		handleEnqueueCurrentMessage,
		handleSetChatBoxMessage,
		handleSuggestionClick,
		handleBatchFileResponse,
		handleFollowUpUnmount,
	}
}
