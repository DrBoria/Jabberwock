import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { getAllModes } from "@shared/modes"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { rootStore } from "@src/features/store"
import { ContextMenuOptionType } from "../../utils/context-mentions/context-mentions"
import { usePromptHistory } from "../../hooks/use-prompt-history"
import { getDndTextAreaStyles } from "../utils"
import type { DndTextAreaProps } from "../types"
import { useDragAndDrop } from "./useDragAndDrop"
import { useMessageHandlers } from "./useMessageHandlers"
import { useInputHandlers } from "./useInputHandlers"
import { useInputAndKeyboard } from "./useInputAndKeyboard"
import { useQueryItems } from "./useQueryItems"
import { useDndTextAreaCallbacks } from "./useDndTextAreaCallbacks"

export function useDndTextArea(props: DndTextAreaProps, ref: React.Ref<HTMLTextAreaElement>) {
	const {
		onSend,
		onHeightChange,
		isEditMode = false,
		onCancel,
		isStreaming = false,
		goals = [],
		onAddGoal,
		onReorderGoals,
		shouldDisableImages,
	} = props
	const { t } = useAppTranslation()
	const { filePaths, openedTabs, extensionState, extensionCommands, setMode } = rootStore
	const { cwd, messages, taskHistory, enterBehavior } = extensionState
	const textAreaStore = rootStore.chat.textArea
	const currentConfigId = useMemo(
		() => extensionState.listApiConfigMeta?.find((c) => c.name === extensionState.currentApiConfigName)?.id || "",
		[extensionState.listApiConfigMeta, extensionState.currentApiConfigName],
	)
	const displayName = extensionState.currentApiConfigName || ""
	const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
	const highlightLayerRef = useRef<HTMLDivElement>(null)
	const contextMenuContainerRef = useRef<HTMLDivElement>(null)
	const { handleHistoryNavigation, resetHistoryNavigation, resetOnInputChange } = usePromptHistory({
		messages,
		taskHistory,
		cwd,
		inputValue: textAreaStore.inputValue,
		setInputValue: textAreaStore.setInputValue,
	})
	const allModes = useMemo(() => getAllModes(extensionState.customModes), [extensionState.customModes])
	const hasTextInput = textAreaStore.inputValue.trim().length > 0
	const hasContent = hasTextInput || textAreaStore.selectedImages.length > 0
	const isSendVisible = isEditMode || isStreaming || hasContent || goals.length > 0
	const sendKeyCombination = useMemo(() => (enterBehavior === "newline" ? "Shift+Enter" : "Enter"), [enterBehavior])
	const queryItems = useQueryItems(filePaths, openedTabs, textAreaStore)
	useEffect(() => {
		const handleClickOutside = () => {
			if (textAreaStore.showDropdown) textAreaStore.setShowDropdown(false)
		}
		document.addEventListener("mousedown", handleClickOutside)
		return () => document.removeEventListener("mousedown", handleClickOutside)
	}, [textAreaStore.showDropdown, textAreaStore])
	useEffect(() => {
		if (textAreaStore.selectedType === ContextMenuOptionType.Git || /^[a-f0-9]+$/i.test(textAreaStore.searchQuery))
			rootStore.history.searchCommits(textAreaStore.searchQuery || "")
	}, [textAreaStore.selectedType, textAreaStore.searchQuery])
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (contextMenuContainerRef.current && !contextMenuContainerRef.current.contains(event.target as Node))
				textAreaStore.setShowContextMenu(false)
		}
		if (textAreaStore.showContextMenu) document.addEventListener("mousedown", handleClickOutside)
		return () => document.removeEventListener("mousedown", handleClickOutside)
	}, [textAreaStore.showContextMenu, textAreaStore])
	useEffect(() => {
		if (!textAreaStore.showContextMenu) textAreaStore.setSelectedType(ContextMenuOptionType.None)
	}, [textAreaStore.showContextMenu, textAreaStore])
	useLayoutEffect(() => {
		if (textAreaStore.intendedCursorPosition !== -1 && textAreaRef.current) {
			textAreaRef.current.setSelectionRange(
				textAreaStore.intendedCursorPosition,
				textAreaStore.intendedCursorPosition,
			)
			textAreaStore.setIntendedCursorPosition(-1)
		}
	}, [textAreaStore, textAreaStore.intendedCursorPosition])
	const { handleDrop, handleDragOver, handleDragLeave } = useDragAndDrop(
		textAreaStore,
		shouldDisableImages,
		cwd ?? "",
	)
	const { handleEnhancePrompt } = useMessageHandlers(textAreaStore, textAreaRef)
	const { handleInputChange, handleBlur, handlePaste } = useInputHandlers(
		textAreaStore,
		textAreaRef,
		shouldDisableImages,
		resetOnInputChange,
	)
	const {
		handleMentionSelect,
		handleKeyDown,
		handleMenuMouseDown,
		updateHighlights,
		updateCursorPosition,
		handleKeyUp,
		handleTextareaKeyDown,
		placeholderBottomText,
	} = useInputAndKeyboard({
		textAreaStore,
		textAreaRef,
		highlightLayerRef,
		allModes,
		commands: extensionCommands,
		queryItems,
		enterBehavior,
		isEditMode,
		isStreaming,
		onAddGoal,
		onSend,
		onCancel,
		setMode,
		shouldDisableImages,
		t,
		handleHistoryNavigation,
		resetHistoryNavigation,
	})
	useLayoutEffect(() => {
		updateHighlights()
	}, [textAreaStore, updateHighlights])
	const {
		handleTextareaRef,
		handleHeightChange,
		handleSetImages,
		handleModeChange,
		handleApiConfigChange,
		handleToggleLockApiConfig,
		moveGoal,
	} = useDndTextAreaCallbacks(props, textAreaStore, textAreaRef, ref, onHeightChange, onReorderGoals)
	const {
		containerClassName,
		innerDivClassName,
		textAreaWrapperClassName,
		contextMenuClassName,
		borderStyle,
		editModePadding,
		draggingBackground,
	} = getDndTextAreaStyles(isEditMode, textAreaStore.isFocused, textAreaStore.isDraggingOver)
	return {
		extensionCommands,
		textAreaRef,
		highlightLayerRef,
		contextMenuContainerRef,
		textAreaStore,
		mode: extensionState.mode,
		t,
		currentConfigId,
		displayName,
		allModes,
		hasTextInput,
		hasContent,
		isSendVisible,
		sendKeyCombination,
		queryItems,
		placeholderBottomText,
		containerClassName,
		innerDivClassName,
		textAreaWrapperClassName,
		contextMenuClassName,
		borderStyle,
		editModePadding,
		draggingBackground,
		showEditModeGoalInput: isEditMode,
		showContextMenu: textAreaStore.showContextMenu,
		showThumbnails: textAreaStore.selectedImages.length > 0,
		handleMentionSelect,
		handleKeyDown,
		handleInputChange,
		handleBlur,
		handlePaste,
		handleMenuMouseDown,
		updateHighlights,
		updateCursorPosition,
		handleKeyUp,
		handleDrop,
		handleDragOver,
		handleDragLeave,
		handleTextareaRef,
		handleTextareaKeyDown,
		handleHeightChange,
		handleSetImages,
		handleModeChange,
		handleApiConfigChange,
		handleToggleLockApiConfig,
		handleEnhancePrompt,
		moveGoal,
		listApiConfigMeta: extensionState.listApiConfigMeta,
		pinnedApiConfigs: rootStore.extensionState.pinnedApiConfigs,
		lockApiConfigAcrossModes: extensionState.lockApiConfigAcrossModes,
		customModes: extensionState.customModes,
		customModePrompts: rootStore.extensionState.customModePrompts,
		devtoolEnabled: extensionState.devtoolEnabled,
		cloudUserInfo: rootStore.extensionState.cloudUserInfo,
		togglePinnedApiConfig: rootStore.togglePinnedApiConfig,
	}
}
