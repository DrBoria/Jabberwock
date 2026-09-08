import { useCallback } from "react"
import { useEvent } from "react-use"

import type { ExtensionMessage } from "@jabberwock/types"
import { isRetiredProvider } from "@jabberwock/types"

import { rootStore } from "@src/features/store"
import { useSelectedModel } from "@src/features/foundation/ui/hooks/useSelectedModel/useSelectedModel"
import { getShouldDisableImages } from "./chat-view-utils"

import { sendGoalAdd, sendGoalRemove, sendGoalUpdate, sendGoalReorder } from "@src/features/chat/task/events/actions"

export const useGoalHandlers = () => {
	const handleAddGoal = useCallback((text: string) => {
		sendGoalAdd(text)
	}, [])
	const handleRemoveGoal = useCallback((id: string) => {
		sendGoalRemove(id)
	}, [])
	const handleUpdateGoal = useCallback((id: string, partial: Partial<{ text: string; importance: number }>) => {
		sendGoalUpdate(id, partial)
	}, [])
	const handleReorderGoals = useCallback((fromIndex: number, toIndex: number) => {
		sendGoalReorder(fromIndex, toIndex)
	}, [])

	return { handleAddGoal, handleRemoveGoal, handleUpdateGoal, handleReorderGoals }
}

export const useSendMessageHandlers = (
	apiConfiguration: { apiProvider?: string } | undefined,
	isStreaming: boolean,
	messageQueue: { id: string }[],
	store: {
		queueMessage: (text: string, images: string[]) => void
		sendMessage: (text: string, images: string[]) => void
		clearTask?: () => void
		cancelTask?: () => void
	},
	ui: {
		setShowRetiredProviderWarning: (v: boolean) => void
		currentAsk: string | undefined
		textArea: {
			sendingDisabled: boolean
			clearInput: () => void
			inputValue: string
			selectedImages: string[]
			setInputValue: (v: string) => void
			appendSelectedImages: (v: string[]) => void
		}
	},
) => {
	const handleSendMessage = useCallback(
		(text: string, images: string[]) => {
			text = text.trim()
			if (text || images.length > 0) {
				if (apiConfiguration?.apiProvider && isRetiredProvider(apiConfiguration.apiProvider)) {
					ui.setShowRetiredProviderWarning(true)
					return
				}
				if (
					ui.textArea.sendingDisabled ||
					isStreaming ||
					messageQueue.length > 0 ||
					ui.currentAsk === "command_output"
				) {
					store.queueMessage(text, images)
					ui.textArea.clearInput()
					return
				}
				store.sendMessage(text, images)
				ui.textArea.clearInput()
			}
		},
		[isStreaming, messageQueue.length, apiConfiguration?.apiProvider, ui, store],
	)

	const _handleSetChatBoxMessage = useCallback(
		(text: string, images: string[]) => {
			ui.textArea.setInputValue(ui.textArea.inputValue !== "" ? ui.textArea.inputValue + " " + text : text)
			ui.textArea.appendSelectedImages(images)
		},
		[ui],
	)

	const _startNewTask = useCallback(() => {
		ui.setShowRetiredProviderWarning(false)
		ui.textArea.clearInput()
		store.clearTask?.()
	}, [ui, store])

	const handleStopTask = useCallback(() => {
		store.cancelTask?.()
	}, [store])

	const handleEnqueueCurrentMessage = useCallback(() => {
		const text = ui.textArea.inputValue.trim()
		const images = ui.textArea.selectedImages.slice()
		if (text || images.length > 0) {
			store.queueMessage(text, images)
			ui.textArea.clearInput()
		}
	}, [ui, store])

	return { handleSendMessage, _handleSetChatBoxMessage, _startNewTask, handleStopTask, handleEnqueueCurrentMessage }
}

export const useMessageReceiver = (playSound: (type: string) => void) => {
	const handleMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data
			if (message.type === "interactionRequired") playSound("notification")
			rootStore.handleExtensionMessage(message)
		},
		[playSound],
	)

	useEvent("message", handleMessage)
}

export const useQueueHandlers = (
	messageQueue: { id: string; images: string[] }[],
	store: {
		removeQueuedMessage: (id: string) => void
		editQueuedMessage: (id: string, text: string, images: string[]) => void
	},
) => {
	const handleRemoveQueuedMessage = useCallback(
		(index: number) => {
			if (messageQueue[index]) store.removeQueuedMessage(messageQueue[index].id)
		},
		[messageQueue, store],
	)

	const handleEditQueuedMessage = useCallback(
		(index: number, newText: string) => {
			if (messageQueue[index])
				store.editQueuedMessage(messageQueue[index].id, newText, messageQueue[index].images)
		},
		[messageQueue, store],
	)

	return { handleRemoveQueuedMessage, handleEditQueuedMessage }
}

import type { ProviderSettings } from "@jabberwock/types"

export const useModelInfo = (apiConfiguration: ProviderSettings | undefined) => {
	const { info: model } = useSelectedModel(apiConfiguration)

	const selectImages = useCallback(() => rootStore.chat.selectImages(), [])
	const shouldDisableImages = getShouldDisableImages(model, rootStore.chat.textArea.selectedImages.length)

	return { model, selectImages, shouldDisableImages }
}
