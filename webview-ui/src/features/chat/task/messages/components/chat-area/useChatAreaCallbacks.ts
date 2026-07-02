import { useCallback, type RefObject } from "react"
import type { Notification, SuggestionItem, HistoryItem } from "@jabberwock/types"
import type { IChatUIStore, IChatStore } from "@src/features/chat/store"
import { isInputEmpty, isSendBlocked, handleAskResponse, handleModeNavigation } from "./message-area.utils"

interface UseChatAreaCallbacksOptions {
	ui: IChatUIStore
	store: IChatStore
	currentTaskItem: HistoryItem | undefined
	currentAsk: string | undefined
	isStreaming: boolean
	messageQueue: unknown[]
	messagesRef: RefObject<Notification[]>
	currentAskRef: RefObject<string | undefined>
	markFollowUpAsAnswered: () => void
	handleChatReset: (shouldPostMessage?: boolean) => void
	alwaysAllowModeSwitch: boolean | undefined
}

export const useChatAreaCallbacks = ({
	ui,
	store,
	currentTaskItem,
	currentAsk,
	isStreaming,
	messageQueue,
	messagesRef,
	currentAskRef,
	markFollowUpAsAnswered,
	handleChatReset,
	alwaysAllowModeSwitch,
}: UseChatAreaCallbacksOptions) => {
	const handleSendMessage = useCallback(
		(text: string, images: string[]) => {
			const textTrimmed = text.trim()
			if (isInputEmpty(textTrimmed, images)) return
			const isCommandOutput = currentAskRef.current === "command_output"
			if (
				isSendBlocked(
					ui.textArea.sendingDisabled ?? true,
					isStreaming,
					messageQueue.length > 0,
					isCommandOutput,
				)
			) {
				store.queueMessage(textTrimmed, images)
				ui.textArea.clearInput()
				return
			}
			if (messagesRef.current?.length === 0) store.sendMessage(textTrimmed, images)
			else if (currentAskRef.current)
				handleAskResponse(currentAskRef.current, textTrimmed, images, markFollowUpAsAnswered, (r, rt, ri) =>
					store.respondToAsk(r, rt, ri),
				)
			else store.respondToAsk("messageResponse", textTrimmed, images)
			handleChatReset(false)
		},
		[
			handleChatReset,
			markFollowUpAsAnswered,
			isStreaming,
			messageQueue.length,
			messagesRef,
			currentAskRef,
			ui,
			store,
		],
	)

	const handlePrimaryButtonClick = useCallback(
		(text?: string, images?: string[]) => {
			store.handlePrimaryButtonClick(currentAsk, currentTaskItem, messagesRef.current ?? [], text, images)
			store.ask.resetAskState()
		},
		[currentAsk, currentTaskItem, messagesRef, store],
	)

	const handleSecondaryButtonClick = useCallback(
		(text?: string, images?: string[]) => {
			store.handleSecondaryButtonClick(currentAsk, isStreaming, text, images)
			store.ask.resetAskState()
		},
		[currentAsk, isStreaming, store],
	)

	const handleShiftClick = useCallback(
		(suggestion: SuggestionItem) =>
			ui.textArea.setInputValue(
				ui.textArea.inputValue !== "" ? `${ui.textArea.inputValue} \n${suggestion.answer}` : suggestion.answer,
			),
		[ui],
	)

	const handleModeNav = useCallback(
		(suggestion: SuggestionItem, event: React.MouseEvent | undefined) => {
			return handleModeNavigation(suggestion, event, alwaysAllowModeSwitch, (id: string) =>
				store.navigateToTask(id),
			)
		},
		[alwaysAllowModeSwitch, store],
	)

	const handleSuggestionClickInRow = useCallback(
		(suggestion: SuggestionItem, event?: React.MouseEvent) => {
			if (currentAsk === "followup" && !event?.shiftKey) markFollowUpAsAnswered()
			handleModeNav(suggestion, event)
			if (event?.shiftKey) handleShiftClick(suggestion)
			else handleSendMessage(suggestion.answer, [])
		},
		[handleSendMessage, handleModeNav, handleShiftClick, currentAsk, markFollowUpAsAnswered],
	)

	return {
		handleSendMessage,
		handlePrimaryButtonClick,
		handleSecondaryButtonClick,
		handleSuggestionClickInRow,
	}
}
