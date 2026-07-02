import { mentionRegex } from "@shared/context/mentions"
import { escapeSpaces } from "./path-mentions"
import type { ModeConfig, Command } from "@jabberwock/types"
import { ContextMenuOptionType, type ContextMenuQueryItem, type SearchResult } from "./context-mention-types"
import { getSlashCommandOptions, getEmptyQueryOptions, getFilteredAndDedupedOptions } from "./context-mention-helpers"

export { ContextMenuOptionType, type ContextMenuQueryItem, type SearchResult }

export function insertMention(
	text: string,
	position: number,
	value: string,
	isSlashCommand: boolean = false,
): { newValue: string; mentionIndex: number } {
	if (isSlashCommand) {
		return {
			newValue: value,
			mentionIndex: 0,
		}
	}

	const beforeCursor = text.slice(0, position)
	const afterCursor = text.slice(position)

	const lastAtIndex = beforeCursor.lastIndexOf("@")

	let processedValue = value
	if (value && value.startsWith("/")) {
		if (value.includes(" ") && !value.includes("\\ ")) {
			processedValue = escapeSpaces(value)
		}
	}

	let newValue: string
	let mentionIndex: number

	if (lastAtIndex !== -1) {
		const beforeMention = text.slice(0, lastAtIndex)
		const afterCursorContent = /^[a-zA-Z0-9\s]*$/.test(afterCursor)
			? afterCursor.replace(/^[^\s]*/, "")
			: afterCursor
		newValue = beforeMention + "@" + processedValue + " " + afterCursorContent
		mentionIndex = lastAtIndex
	} else {
		newValue = beforeCursor + "@" + processedValue + " " + afterCursor
		mentionIndex = position
	}

	return { newValue, mentionIndex }
}

export function removeMention(text: string, position: number): { newText: string; newPosition: number } {
	const beforeCursor = text.slice(0, position)
	const afterCursor = text.slice(position)

	const matchEnd = beforeCursor.match(new RegExp(mentionRegex.source + "$"))

	if (matchEnd) {
		const mentionLength = matchEnd[0].length
		const newText = text.slice(0, position - mentionLength) + afterCursor.replace(/^\s/, "")
		const newPosition = position - mentionLength
		return { newText, newPosition }
	}

	return { newText: text, newPosition: position }
}

export function getContextMenuOptions(
	query: string,
	selectedType: ContextMenuOptionType = ContextMenuOptionType.None,
	queryItems: ContextMenuQueryItem[],
	dynamicSearchResults: SearchResult[] = [],
	modes?: ModeConfig[],
	commands?: Command[],
): ContextMenuQueryItem[] {
	if (query.startsWith("/")) {
		return getSlashCommandOptions(query.slice(1), commands, modes)
	}

	if (query === "") {
		const workingChanges: ContextMenuQueryItem = {
			type: ContextMenuOptionType.Git,
			value: "git-changes",
			label: "Working changes",
			description: "Current uncommitted changes",
			icon: "$(git-commit)",
		}
		return getEmptyQueryOptions(selectedType, queryItems, workingChanges)
	}

	return getFilteredAndDedupedOptions(query, queryItems, dynamicSearchResults)
}

export function shouldShowContextMenu(text: string, position: number): boolean {
	const beforeCursor = text.slice(0, position)

	if (text.startsWith("/") && !text.includes(" ") && position <= text.length) {
		return true
	}

	const atIndex = beforeCursor.lastIndexOf("@")

	if (atIndex === -1) {
		return false
	}

	const textAfterAt = beforeCursor.slice(atIndex + 1)

	const hasUnescapedSpace = /(?<!\\)\s/.test(textAfterAt)
	if (hasUnescapedSpace) return false

	if (textAfterAt.toLowerCase().startsWith("http")) {
		return false
	}

	return true
}
