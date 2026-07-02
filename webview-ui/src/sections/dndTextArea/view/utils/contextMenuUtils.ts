import type React from "react"
import { getSnapshot } from "mobx-state-tree"
import type { Command, ModeConfig } from "@jabberwock/types"
import {
	ContextMenuOptionType,
	type ContextMenuQueryItem,
	insertMention,
} from "../../utils/context-mentions/context-mentions"
import { getNextSelectableIndex, getSelectedOption } from "../../utils"
import type { IDynamicTextAreaStore } from "../../store"

export function getInsertValue(type: ContextMenuOptionType, value: string | undefined): string {
	if (type === ContextMenuOptionType.Problems) {
		return "problems"
	}
	if (type === ContextMenuOptionType.Terminal) {
		return "terminal"
	}
	if (type === ContextMenuOptionType.Command) {
		return value ? `/${value}` : ""
	}
	return value || ""
}

export function handleCommandSelection(
	value: string,
	textAreaStore: IDynamicTextAreaStore,
	textAreaRef: React.RefObject<HTMLTextAreaElement | null>,
): void {
	textAreaStore.setSelectedMenuIndex(-1)
	textAreaStore.setInputValue("")
	textAreaStore.setShowContextMenu(false)

	const commandMention = `/${value}`
	textAreaStore.setInputValue(commandMention + " ")
	textAreaStore.setCursorPosition(commandMention.length + 1)
	textAreaStore.setIntendedCursorPosition(commandMention.length + 1)

	setTimeout(() => {
		if (textAreaRef.current) {
			textAreaRef.current.focus()
		}
	}, 0)
}

export function handleModeSelection(
	value: string,
	setMode: (mode: string) => void,
	textAreaStore: IDynamicTextAreaStore,
	switchMode: (mode: string) => void,
): void {
	setMode(value)
	textAreaStore.setInputValue("")
	textAreaStore.setShowContextMenu(false)
	switchMode(value)
}

export function handleFileFolderGitPreSelection(
	type: ContextMenuOptionType,
	textAreaStore: IDynamicTextAreaStore,
): void {
	textAreaStore.setSelectedType(type)
	textAreaStore.setSearchQuery("")
	textAreaStore.setSelectedMenuIndex(0)
}

export function handleInsertMention(
	type: ContextMenuOptionType,
	value: string | undefined,
	textAreaRef: React.RefObject<HTMLTextAreaElement | null>,
	textAreaStore: IDynamicTextAreaStore,
): void {
	textAreaStore.setShowContextMenu(false)
	textAreaStore.setSelectedType(ContextMenuOptionType.None)

	if (!textAreaRef.current) {
		return
	}

	const insertValue = getInsertValue(type, value)

	const isSlashCommand = type === ContextMenuOptionType.Mode || type === ContextMenuOptionType.Command

	const { newValue, mentionIndex } = insertMention(
		textAreaRef.current.value,
		textAreaStore.cursorPosition,
		insertValue,
		isSlashCommand,
	)

	textAreaStore.setInputValue(newValue)
	const newCursorPosition = newValue.indexOf(" ", mentionIndex + insertValue.length) + 1
	textAreaStore.setCursorPosition(newCursorPosition)
	textAreaStore.setIntendedCursorPosition(newCursorPosition)

	setTimeout(() => {
		if (textAreaRef.current) {
			textAreaRef.current.blur()
			textAreaRef.current.focus()
		}
	}, 0)
}

export function isValidMenuOption(option: { type: ContextMenuOptionType } | undefined): boolean {
	return (
		option != null &&
		option.type !== ContextMenuOptionType.URL &&
		option.type !== ContextMenuOptionType.NoResults &&
		option.type !== ContextMenuOptionType.SectionHeader
	)
}

export function handleContextMenuKeyboard(
	event: React.KeyboardEvent<HTMLTextAreaElement>,
	textAreaStore: IDynamicTextAreaStore,
	queryItems: ContextMenuQueryItem[],
	allModes: ModeConfig[],
	commands: Command[],
	onSelect: (type: ContextMenuOptionType, value?: string) => void,
): boolean {
	if (!textAreaStore.showContextMenu) {
		return false
	}

	if (event.key === "Escape") {
		textAreaStore.setSelectedType(ContextMenuOptionType.None)
		textAreaStore.setSelectedMenuIndex(3)
		return true
	}

	if (event.key === "ArrowUp" || event.key === "ArrowDown") {
		event.preventDefault()
		const direction = event.key === "ArrowUp" ? -1 : 1
		textAreaStore.setSelectedMenuIndex(
			getNextSelectableIndex(
				textAreaStore.selectedMenuIndex,
				direction,
				textAreaStore.searchQuery,
				textAreaStore.selectedType,
				queryItems,
				getSnapshot(textAreaStore.fileSearchResults),
				allModes,
				commands,
			),
		)
		return true
	}

	if (event.key === "Enter" || event.key === "Tab") {
		if (textAreaStore.selectedMenuIndex === -1) {
			return false
		}

		event.preventDefault()
		const selectedOption = getSelectedOption(
			textAreaStore.selectedMenuIndex,
			textAreaStore.searchQuery,
			textAreaStore.selectedType,
			queryItems,
			getSnapshot(textAreaStore.fileSearchResults),
			allModes,
			commands,
		)
		if (isValidMenuOption(selectedOption)) {
			onSelect(selectedOption.type, selectedOption.value)
		}
		return true
	}

	return false
}
