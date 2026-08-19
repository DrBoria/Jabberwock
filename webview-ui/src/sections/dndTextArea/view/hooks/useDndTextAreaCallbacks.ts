import React, { useCallback } from "react"
import { Mode } from "@shared/modes"
import { rootStore } from "@src/features/store"
import type { IDynamicTextAreaStore } from "../../store"
import type { DndTextAreaProps } from "../types"

export function useDndTextAreaCallbacks(
	props: DndTextAreaProps,
	textAreaStore: IDynamicTextAreaStore,
	textAreaRef: React.MutableRefObject<HTMLTextAreaElement | null>,
	ref: React.Ref<HTMLTextAreaElement>,
	onHeightChange: ((height: number) => void) | undefined,
	onReorderGoals: ((dragIndex: number, hoverIndex: number) => void) | undefined,
) {
	const { isStreaming = false } = props

	const handleTextareaRef = useCallback(
		(el: HTMLTextAreaElement | null) => {
			if (typeof ref === "function") ref(el)
			else if (ref && "current" in ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el
			textAreaRef.current = el
		},
		[ref, textAreaRef],
	)

	const handleHeightChange = useCallback(
		(height: number) => {
			if (textAreaStore.textAreaBaseHeight < 0 || height < textAreaStore.textAreaBaseHeight)
				textAreaStore.setTextAreaBaseHeight(height)
			onHeightChange?.(height)
		},
		[textAreaStore, onHeightChange],
	)

	const handleSetImages = useCallback(
		(valueOrCallback: string[] | ((prev: string[]) => string[])) => {
			if (typeof valueOrCallback === "function")
				textAreaStore.setSelectedImages(valueOrCallback(textAreaStore.selectedImages))
			else textAreaStore.setSelectedImages(valueOrCallback)
		},
		[textAreaStore],
	)

	const handleModeChange = useCallback((value: Mode) => {
		rootStore.setMode(value)
		rootStore.chat.switchMode(value)
	}, [])

	const handleApiConfigChange = useCallback((value: string) => {
		rootStore.settings.loadApiConfigById(value)
	}, [])

	const handleToggleLockApiConfig = useCallback(() => {
		const current = rootStore.extensionState.lockApiConfigAcrossModes
		rootStore.settings.lockApiConfigAcrossModes(!current)
	}, [])

	const moveGoal = useCallback(
		(dragIndex: number, hoverIndex: number) => {
			onReorderGoals?.(dragIndex, hoverIndex)
		},
		[onReorderGoals],
	)

	return {
		handleTextareaRef,
		handleHeightChange,
		handleSetImages,
		handleModeChange,
		handleApiConfigChange,
		handleToggleLockApiConfig,
		moveGoal,
		isStreaming,
	}
}
