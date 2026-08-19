import type React from "react"
import { mentionRegex } from "@shared/context/mentions"
import { shouldSendOnEnter } from "../../utils"
import { removeMention } from "../../utils/context-mentions/context-mentions"
import type { IDynamicTextAreaStore } from "../../store"

export function isAddGoalKeyShortcut(
	event: React.KeyboardEvent<HTMLTextAreaElement>,
	isStreaming: boolean,
	isEditMode: boolean,
	onAddGoal: ((goal: string) => void) | undefined,
	isComposing: boolean,
): boolean {
	return (
		event.key === "Enter" &&
		!isStreaming &&
		!isEditMode &&
		!!onAddGoal &&
		!isComposing &&
		(event.altKey || event.metaKey)
	)
}

export function handleSendOnEnter(
	event: React.KeyboardEvent<HTMLTextAreaElement>,
	enterBehavior: string | undefined,
	isComposing: boolean,
	isEditMode: boolean,
	onAddGoal: ((value: string) => void) | undefined,
	textAreaStore: IDynamicTextAreaStore,
	resetHistoryNavigation: () => void,
	onSend: () => void,
): boolean {
	if (!shouldSendOnEnter(event, enterBehavior, isComposing)) {
		return false
	}

	event.preventDefault()
	if (isEditMode && onAddGoal && textAreaStore.inputValue.trim()) {
		onAddGoal(textAreaStore.inputValue.trim())
		textAreaStore.setInputValue("")
		return true
	}

	resetHistoryNavigation()
	onSend()
	return true
}

export function isBackspaceWithoutComposing(
	event: React.KeyboardEvent<HTMLTextAreaElement>,
	isComposing: boolean,
): boolean {
	return event.key === "Backspace" && !isComposing
}

export function isWhitespace(ch: string): boolean {
	return ch === " " || ch === "\n" || ch === "\r\n"
}

export function handleBackspaceMention(
	charBefore: string,
	charAfter: string,
	textAreaStore: IDynamicTextAreaStore,
	textAreaRef: React.RefObject<HTMLTextAreaElement | null>,
): void {
	const charBeforeIsWhitespace = isWhitespace(charBefore)
	const charAfterIsWhitespace = isWhitespace(charAfter)

	if (
		charBeforeIsWhitespace &&
		textAreaStore.inputValue.slice(0, textAreaStore.cursorPosition - 1).match(new RegExp(mentionRegex.source + "$"))
	) {
		const newCursorPosition = textAreaStore.cursorPosition - 1
		if (!charAfterIsWhitespace) {
			textAreaRef.current?.setSelectionRange(newCursorPosition, newCursorPosition)
		}

		textAreaStore.setCursorPosition(newCursorPosition)
		textAreaStore.setJustDeletedSpaceAfterMention(true)
		return
	}

	if (textAreaStore.justDeletedSpaceAfterMention) {
		const { newText, newPosition } = removeMention(textAreaStore.inputValue, textAreaStore.cursorPosition)

		if (newText !== textAreaStore.inputValue) {
			textAreaStore.setInputValue(newText)
			textAreaStore.setIntendedCursorPosition(newPosition)
		}

		textAreaStore.setJustDeletedSpaceAfterMention(false)
		textAreaStore.setShowContextMenu(false)
		return
	}

	textAreaStore.setJustDeletedSpaceAfterMention(false)
}
