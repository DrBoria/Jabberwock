import { useCallback } from "react"
import type { Command, ModeConfig } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import { ContextMenuOptionType, type ContextMenuQueryItem } from "../../utils/context-mentions/context-mentions"
import { buildHighlightHtml, syncHighlightScroll } from "../../utils"
import {
	handleContextMenuKeyboard,
	handleModeSelection,
	handleCommandSelection,
	handleFileFolderGitPreSelection,
	handleInsertMention,
	handleSendOnEnter,
	isAddGoalKeyShortcut,
	isBackspaceWithoutComposing,
	handleBackspaceMention,
	getPlaceholderBottomText,
} from "../utils"
import type { IDynamicTextAreaStore } from "../../store"

export function useInputAndKeyboard(params: {
	textAreaStore: IDynamicTextAreaStore
	textAreaRef: React.RefObject<HTMLTextAreaElement | null>
	highlightLayerRef: React.RefObject<HTMLDivElement | null>
	allModes: ModeConfig[]
	commands: Command[]
	queryItems: ContextMenuQueryItem[]
	enterBehavior: string | undefined
	isEditMode: boolean
	isStreaming: boolean
	onAddGoal: ((goal: string) => void) | undefined
	onSend: () => void
	onCancel: (() => void) | undefined
	setMode: (mode: string) => void
	shouldDisableImages: boolean
	t: (key: string) => string
	handleHistoryNavigation: (
		event: React.KeyboardEvent<HTMLTextAreaElement>,
		showContextMenu: boolean,
		isComposing: boolean,
	) => boolean
	resetHistoryNavigation: () => void
}) {
	const {
		textAreaStore,
		textAreaRef,
		highlightLayerRef,
		allModes,
		commands,
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
	} = params

	const handleMentionSelect = useCallback(
		(type: ContextMenuOptionType, value?: string) => {
			if (type === ContextMenuOptionType.NoResults) return

			if (type === ContextMenuOptionType.Mode && value) {
				handleModeSelection(value, setMode, textAreaStore, (v: string) => rootStore.chat.switchMode(v))
				return
			}

			if (type === ContextMenuOptionType.Command && value) {
				handleCommandSelection(value, textAreaStore, textAreaRef)
				return
			}

			if (
				type === ContextMenuOptionType.File ||
				type === ContextMenuOptionType.Folder ||
				type === ContextMenuOptionType.Git
			) {
				if (!value) {
					handleFileFolderGitPreSelection(type, textAreaStore)
					return
				}
			}

			handleInsertMention(type, value, textAreaRef, textAreaStore)
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[textAreaStore.cursorPosition, textAreaStore, setMode, textAreaRef],
	)

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (handleContextMenuKeyboard(event, textAreaStore, queryItems, allModes, commands, handleMentionSelect))
				return

			const isComposing = event.nativeEvent?.isComposing ?? false

			if (handleHistoryNavigation(event, textAreaStore.showContextMenu, isComposing)) return

			if (
				handleSendOnEnter(
					event,
					enterBehavior,
					isComposing,
					isEditMode,
					onAddGoal,
					textAreaStore,
					resetHistoryNavigation,
					onSend,
				)
			)
				return

			if (
				isAddGoalKeyShortcut(event, isStreaming, isEditMode, onAddGoal, isComposing) &&
				textAreaStore.inputValue.trim()
			) {
				event.preventDefault()
				onAddGoal?.(textAreaStore.inputValue.trim())
				textAreaStore.setInputValue("")
				return
			}

			if (isBackspaceWithoutComposing(event, isComposing)) {
				handleBackspaceMention(
					textAreaStore.inputValue[textAreaStore.cursorPosition - 1],
					textAreaStore.inputValue[textAreaStore.cursorPosition + 1],
					textAreaStore,
					textAreaRef,
				)
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			onSend,
			handleMentionSelect,
			queryItems,
			allModes,
			handleHistoryNavigation,
			resetHistoryNavigation,
			commands,
			enterBehavior,
			textAreaStore,
			isStreaming,
			isEditMode,
			onAddGoal,
		],
	)

	const handleMenuMouseDown = useCallback(() => {
		textAreaStore.setIsMouseDownOnMenu(true)
	}, [textAreaStore])

	const updateHighlights = useCallback(() => {
		if (!textAreaRef.current || !highlightLayerRef.current) return
		highlightLayerRef.current.innerHTML = buildHighlightHtml(textAreaRef.current.value, commands || [])
		syncHighlightScroll(textAreaRef.current, highlightLayerRef.current)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [commands])

	const updateCursorPosition = useCallback(() => {
		if (textAreaRef.current) textAreaStore.setCursorPosition(textAreaRef.current.selectionStart)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [textAreaStore])

	const handleKeyUp = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key))
				updateCursorPosition()
		},
		[updateCursorPosition],
	)

	const handleTextareaKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (isEditMode && e.key === "Escape" && !e.nativeEvent?.isComposing) {
				e.preventDefault()
				onCancel?.()
				return
			}
			handleKeyDown(e)
		},
		[isEditMode, onCancel, handleKeyDown],
	)

	const placeholderBottomText = getPlaceholderBottomText(t, shouldDisableImages)

	return {
		handleMentionSelect,
		handleKeyDown,
		handleMenuMouseDown,
		updateHighlights,
		updateCursorPosition,
		handleKeyUp,
		handleTextareaKeyDown,
		placeholderBottomText,
	}
}
