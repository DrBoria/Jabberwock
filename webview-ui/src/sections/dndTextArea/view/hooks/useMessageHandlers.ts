import { useCallback, useEffect } from "react"
import { useEvent } from "react-use"
import type { ExtensionMessage } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import {
	handleEnhancedPromptResult,
	handleInsertTextHandler,
	handleCommitSearchResultsHandler,
	handleFileSearchResultsHandler,
} from "../utils"
import type { IDynamicTextAreaStore } from "../../store"

export function useMessageHandlers(
	textAreaStore: IDynamicTextAreaStore,
	textAreaRef: React.RefObject<HTMLTextAreaElement | null>,
) {
	useEffect(() => {
		const messageHandler = (event: MessageEvent) => {
			const message = event.data

			if (message.type === "enhancedPrompt") {
				handleEnhancedPromptResult(message, textAreaRef, textAreaStore)
			} else if (message.type === "insertTextIntoTextarea") {
				handleInsertTextHandler(message, textAreaRef, textAreaStore)
			} else if (message.type === "commitSearchResults") {
				handleCommitSearchResultsHandler(message, textAreaStore)
			} else if (message.type === "fileSearchResults") {
				handleFileSearchResultsHandler(message, textAreaStore)
			}
		}

		window.addEventListener("message", messageHandler)
		return () => window.removeEventListener("message", messageHandler)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [textAreaStore.searchRequestId, textAreaStore])

	useEvent("message", (event: MessageEvent) => {
		const message: ExtensionMessage = event.data

		if (message.type === "ttsStart") {
			textAreaStore.setIsTtsPlaying(true)
		} else if (message.type === "ttsStop") {
			textAreaStore.setIsTtsPlaying(false)
		}
	})

	const handleEnhancePrompt = useCallback(() => {
		const trimmedInput = textAreaStore.inputValue.trim()

		if (trimmedInput) {
			textAreaStore.setIsEnhancingPrompt(true)
			rootStore.chat.enhancePrompt(trimmedInput)
		} else {
			textAreaStore.setInputValue("")
		}
	}, [textAreaStore])

	return { handleEnhancePrompt }
}
