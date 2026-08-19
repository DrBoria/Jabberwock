import { useCallback, useRef } from "react"
import { unescapeSpaces } from "@shared/context/mentions"
import { rootStore } from "@src/features/store"
import { shouldShowContextMenu } from "../../utils/context-mentions/context-mentions"
import { isUrl, insertUrlAtCursor, extractImagesFromClipboard, generateSearchRequestId } from "../../utils"
import type { IDynamicTextAreaStore } from "../../store"

export function useInputHandlers(
	textAreaStore: IDynamicTextAreaStore,
	textAreaRef: React.RefObject<HTMLTextAreaElement | null>,
	shouldDisableImages: boolean,
	resetOnInputChange: () => void,
) {
	const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			const newValue = e.target.value
			textAreaStore.setInputValue(newValue)

			resetOnInputChange()

			const newCursorPosition = e.target.selectionStart
			textAreaStore.setCursorPosition(newCursorPosition)

			const showMenu = shouldShowContextMenu(newValue, newCursorPosition)
			textAreaStore.setShowContextMenu(showMenu)

			if (showMenu) {
				if (newValue.startsWith("/") && !newValue.includes(" ")) {
					const query = newValue
					textAreaStore.setSearchQuery(query)
					textAreaStore.setSelectedMenuIndex(1)
					rootStore.chat.requestCommands()
				} else {
					const lastAtIndex = newValue.lastIndexOf("@", newCursorPosition - 1)
					const query = newValue.slice(lastAtIndex + 1, newCursorPosition)
					textAreaStore.setSearchQuery(query)

					if (query.length > 0) {
						textAreaStore.setSelectedMenuIndex(0)

						if (searchTimeoutRef.current) {
							clearTimeout(searchTimeoutRef.current)
						}

						searchTimeoutRef.current = setTimeout(() => {
							const reqId = generateSearchRequestId()
							textAreaStore.setSearchRequestId(reqId)
							textAreaStore.setSearchLoading(true)

							rootStore.chat.searchFiles(unescapeSpaces(query), reqId)
						}, 200)
					} else {
						textAreaStore.setSelectedMenuIndex(3)
					}
				}
			} else {
				textAreaStore.setSearchQuery("")
				textAreaStore.setSelectedMenuIndex(-1)
				textAreaStore.setFileSearchResults([])
			}
		},
		[resetOnInputChange, textAreaStore],
	)

	const handleBlur = useCallback(() => {
		if (!textAreaStore.isMouseDownOnMenu) {
			textAreaStore.setShowContextMenu(false)
		}

		textAreaStore.setIsFocused(false)
	}, [textAreaStore])

	const handlePaste = useCallback(
		async (e: React.ClipboardEvent) => {
			const pastedText = e.clipboardData.getData("text")

			if (isUrl(pastedText)) {
				e.preventDefault()
				const { newValue, newCursorPosition } = insertUrlAtCursor(
					textAreaStore.inputValue,
					textAreaStore.cursorPosition,
					pastedText,
				)
				textAreaStore.setInputValue(newValue)
				textAreaStore.setCursorPosition(newCursorPosition)
				textAreaStore.setIntendedCursorPosition(newCursorPosition)
				textAreaStore.setShowContextMenu(false)

				setTimeout(() => {
					if (textAreaRef.current) {
						textAreaRef.current.blur()
						textAreaRef.current.focus()
					}
				}, 0)
				return
			}

			if (!shouldDisableImages) {
				const dataUrls = await extractImagesFromClipboard(
					e.clipboardData.items,
					textAreaStore.selectedImages.length,
				)
				if (dataUrls.length > 0) {
					e.preventDefault()
					textAreaStore.appendSelectedImages(dataUrls)
				}
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[shouldDisableImages, textAreaStore],
	)

	return { handleInputChange, handleBlur, handlePaste }
}
