import { useCallback } from "react"
import { processDroppedText, extractImagesFromFiles } from "../../utils"
import type { IDynamicTextAreaStore } from "../../store"

export function useDragAndDrop(textAreaStore: IDynamicTextAreaStore, shouldDisableImages: boolean, cwd: string) {
	const handleDrop = useCallback(
		async (e: React.DragEvent<HTMLDivElement>) => {
			e.preventDefault()
			textAreaStore.setIsDraggingOver(false)

			const textFieldList = e.dataTransfer.getData("text")
			const textUriList = e.dataTransfer.getData("application/vnd.code.uri-list")
			const text = textFieldList || textUriList

			if (text) {
				const { newValue, newCursorPosition } = processDroppedText(
					text,
					textAreaStore.inputValue,
					textAreaStore.cursorPosition,
					cwd,
				)
				if (newValue !== textAreaStore.inputValue) {
					textAreaStore.setInputValue(newValue)
					textAreaStore.setCursorPosition(newCursorPosition)
					textAreaStore.setIntendedCursorPosition(newCursorPosition)
				}
				return
			}

			if (!shouldDisableImages && e.dataTransfer.files.length > 0) {
				const dataUrls = await extractImagesFromFiles(e.dataTransfer.files, textAreaStore.selectedImages.length)
				if (dataUrls.length > 0) {
					textAreaStore.appendSelectedImages(dataUrls)
				}
			}
		},
		[cwd, shouldDisableImages, textAreaStore],
	)

	const handleDragOver = useCallback(
		(e: React.DragEvent) => {
			if (!e.shiftKey) {
				textAreaStore.setIsDraggingOver(false)
				return
			}

			e.preventDefault()
			textAreaStore.setIsDraggingOver(true)
			e.dataTransfer.dropEffect = "copy"
		},
		[textAreaStore],
	)

	const handleDragLeave = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			const rect = e.currentTarget.getBoundingClientRect()

			if (
				e.clientX <= rect.left ||
				e.clientX >= rect.right ||
				e.clientY <= rect.top ||
				e.clientY >= rect.bottom
			) {
				textAreaStore.setIsDraggingOver(false)
			}
		},
		[textAreaStore],
	)

	return { handleDrop, handleDragOver, handleDragLeave }
}
