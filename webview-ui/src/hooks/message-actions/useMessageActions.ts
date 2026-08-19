import { useCallback, useRef } from "react"
import type { NotificationAsk, Notification } from "@jabberwock/types"
import { isRetiredProvider } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import { isMessageBlocked } from "./message-action-utils"
import type { MessageActions } from "./message-action-utils"
import { useMessageActionsButtons } from "./useMessageActions.buttons"

/**
 * Creates message action handlers for ChatView.
 * Pure function — no state, no hooks. Takes all dependencies explicitly.
 * The parent component wires inputValue/selectedImages via the returned handlers.
 */

export function useMessageActions(
	currentAsk: NotificationAsk | undefined,
	currentAskRef: React.MutableRefObject<NotificationAsk | undefined>,
	sendingDisabled: boolean,
	isStreaming: boolean,
	messageQueue: { id: string }[],
	messages: Notification[],
	currentTaskItem: { parentTaskId?: string; id?: string } | undefined,
	apiConfiguration: { apiProvider?: string } | undefined,
	_onResetState: () => void,
	onSetSendingDisabled: (v: boolean) => void,
	onSetClineAsk: (v: NotificationAsk | undefined) => void,
	onSetEnableButtons: (v: boolean) => void,
	onSetPrimaryButtonText: (v: string | undefined) => void,
	onSetSecondaryButtonText: (v: string | undefined) => void,
	onSetInputValue: (v: string) => void,
	onSetSelectedImages: (v: string[]) => void,
): MessageActions {
	const userRespondedRef = useRef(false)
	const { handlePrimaryButtonClick, handleSecondaryButtonClick, startNewTask } = useMessageActionsButtons(
		currentAsk,
		currentTaskItem,
		messages,
		isStreaming,
		userRespondedRef,
		onSetSendingDisabled,
		onSetClineAsk,
		onSetEnableButtons,
		onSetPrimaryButtonText,
		onSetSecondaryButtonText,
		onSetInputValue,
		onSetSelectedImages,
	)
	const markFollowUpAsAnswered = useCallback(() => {
		const lastFollowUp = messages.findLast((msg: Notification) => msg.ask === "followup")
		if (lastFollowUp) rootStore.chat.followUpAnswered(lastFollowUp.ts)
	}, [messages])
	const handleChatReset = useCallback(
		(shouldPostMessage: boolean = true) => {
			onSetSendingDisabled(false)
			onSetClineAsk(undefined)
			onSetEnableButtons(false)
			onSetInputValue("")
			onSetSelectedImages([])
			if (shouldPostMessage) rootStore.chat.clearTask()
		},
		[onSetSendingDisabled, onSetClineAsk, onSetEnableButtons, onSetInputValue, onSetSelectedImages],
	)
	const handleSendMessage = useCallback(
		(text: string, images: string[]) => {
			text = text.trim()
			if (!text && images.length === 0) return
			if (apiConfiguration?.apiProvider && isRetiredProvider(apiConfiguration.apiProvider)) return
			if (isMessageBlocked(sendingDisabled, isStreaming, messageQueue.length, currentAskRef.current)) {
				rootStore.chat.queueMessage(text, images)
				onSetInputValue("")
				onSetSelectedImages([])
				return
			}
			userRespondedRef.current = true
			if (messages.length === 0) {
				rootStore.chat.sendMessage(text, images)
			} else if (currentAskRef.current) {
				if (currentAskRef.current === "followup") markFollowUpAsAnswered()
				rootStore.chat.respondToAsk("messageResponse", text, images)
			} else {
				rootStore.chat.respondToAsk("messageResponse", text, images)
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
			currentAskRef,
			userRespondedRef,
			onSetInputValue,
			onSetSelectedImages,
		],
	)
	const handleStopTask = useCallback(() => {
		rootStore.chat.cancelTask()
	}, [])
	const handleEnqueueCurrentMessage = useCallback(
		(text: string, images: string[]) => {
			if (text.trim() || images.length > 0) {
				rootStore.chat.queueMessage(text.trim(), images)
				onSetInputValue("")
				onSetSelectedImages([])
			}
		},
		[onSetInputValue, onSetSelectedImages],
	)
	const handleSetChatBoxMessage = useCallback((text: string, images: string[]) => {
		rootStore.chat.setChatBoxMessage(text, images)
	}, [])
	const handleSuggestionClick = useCallback(
		(
			suggestion: { answer: string; mode?: string; id?: string },
			event: React.MouseEvent | undefined,
			_store: { navigateToNode: (id: string) => void },
			alwaysAllowModeSwitch: boolean,
		) => {
			if (event) userRespondedRef.current = true
			if (suggestion.mode) {
				const isManualClick = !!event
				if (isManualClick || alwaysAllowModeSwitch) {
					if (suggestion.id) rootStore.chat.navigateToTask(suggestion.id)
				}
			}
			if (event?.shiftKey) {
				rootStore.chat.setChatBoxMessage(suggestion.answer, [])
			} else {
				handleSendMessage(suggestion.answer, [])
			}
		},
		[handleSendMessage, userRespondedRef],
	)
	const handleBatchFileResponse = useCallback((response: { [key: string]: boolean }) => {
		rootStore.windowManager.batchFileResponse(response)
	}, [])
	const handleFollowUpUnmount = useCallback(() => {
		rootStore.chat.cancelAutoApproval()
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
