/**
 * Input handling utilities for ChatTextArea.
 * Context menu filtering, search debouncing, and keyboard navigation.
 */

import type { Command, ModeConfig } from "@jabberwock/types"
import { ContextMenuOptionType, type SearchResult, getContextMenuOptions } from "./context-mentions/context-mentions"

/**
 * Finds the next selectable index in the context menu given a direction.
 */
export function getNextSelectableIndex(
	currentIndex: number,
	direction: -1 | 1,
	searchQuery: string,
	selectedType: ContextMenuOptionType,
	queryItems: Array<{ type: ContextMenuOptionType; value?: string }>,
	fileSearchResults: SearchResult[],
	allModes: ModeConfig[],
	commands: Command[],
): number {
	const options = getContextMenuOptions(searchQuery, selectedType, queryItems, fileSearchResults, allModes, commands)
	if (options.length === 0) return currentIndex

	const selectableOptions = options.filter(
		(option) =>
			option.type !== ContextMenuOptionType.URL &&
			option.type !== ContextMenuOptionType.NoResults &&
			option.type !== ContextMenuOptionType.SectionHeader,
	)

	if (selectableOptions.length === 0) return -1

	const currentSelectableIndex = selectableOptions.findIndex((option) => option === options[currentIndex])
	const newSelectableIndex =
		(currentSelectableIndex + direction + selectableOptions.length) % selectableOptions.length

	return options.findIndex((option) => option === selectableOptions[newSelectableIndex])
}

/**
 * Gets the selected option from the context menu at the given index.
 */
export function getSelectedOption(
	selectedMenuIndex: number,
	searchQuery: string,
	selectedType: ContextMenuOptionType,
	queryItems: Array<{ type: ContextMenuOptionType; value?: string }>,
	fileSearchResults: SearchResult[],
	allModes: ModeConfig[],
	commands: Command[],
) {
	const options = getContextMenuOptions(searchQuery, selectedType, queryItems, fileSearchResults, allModes, commands)
	return options[selectedMenuIndex]
}

/**
 * Determines if a keyboard event should trigger send.
 *
 * Default ("send"): Enter sends, Shift+Enter inserts newline.
 * "newline": Shift+Enter sends, Enter inserts newline.
 */
export function shouldSendOnEnter(
	event: React.KeyboardEvent<HTMLTextAreaElement>,
	enterBehavior: string | undefined,
	isComposing: boolean,
): boolean {
	if (isComposing) return false

	const isEnterKey = event.key === "Enter"
	if (!isEnterKey) return false

	const isNewlineMode = enterBehavior === "newline"
	if (isNewlineMode) {
		return isShiftOrModifierKey(event)
	}

	return !event.shiftKey
}

function isShiftOrModifierKey(event: React.KeyboardEvent): boolean {
	if (event.shiftKey) return true
	if (event.ctrlKey) return true
	if (event.metaKey) return true
	return false
}

/**
 * Generates a unique request ID for file search.
 */
export function generateSearchRequestId(): string {
	const id = Math.random().toString(36)
	return id.substring(2, 9)
}
