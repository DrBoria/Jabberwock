/**
 * Text processing utilities for ChatTextArea.
 * Handles URL detection, mention/command highlighting, and cursor management.
 */

import { mentionRegexGlobal, commandRegexGlobal } from "@shared/context-mentions"

/**
 * Detects if a string is a URL (protocol://...).
 */
export function isUrl(text: string): boolean {
	return /^\S+:\/\/\S+$/.test(text.trim())
}

/**
 * Inserts a URL at the cursor position, adding a trailing space.
 */
export function insertUrlAtCursor(
	currentValue: string,
	cursorPosition: number,
	url: string,
): { newValue: string; newCursorPosition: number } {
	const trimmedUrl = url.trim()
	const newValue = currentValue.slice(0, cursorPosition) + trimmedUrl + " " + currentValue.slice(cursorPosition)
	const newCursorPosition = cursorPosition + trimmedUrl.length + 1
	return { newValue, newCursorPosition }
}

/**
 * Checks if a command name exists in the valid commands list.
 */
export function isValidCommand(commandName: string, commands: Array<{ name: string }>): boolean {
	return commands?.some((cmd) => cmd.name === commandName) || false
}

/**
 * Builds the highlighted HTML for the mention/command highlight layer.
 */
export function buildHighlightHtml(text: string, commands: Array<{ name: string }>): string {
	let processedText = text
		.replace(/\n$/, "\n\n")
		.replace(/[<>&]/g, (c) => ({ "<": "<", ">": ">", "&": "&" })[c] || c)
		.replace(mentionRegexGlobal, '<mark class="mention-context-textarea-highlight">$&</mark>')

	// Custom replacement for commands - only highlight valid ones
	processedText = processedText.replace(commandRegexGlobal, (match, commandName) => {
		if (isValidCommand(commandName, commands)) {
			const startsWithSpace = match.startsWith(" ")
			const commandPart = `/${commandName}`
			if (startsWithSpace) {
				return ` <mark class="mention-context-textarea-highlight">${commandPart}</mark>`
			}
			return `<mark class="mention-context-textarea-highlight">${commandPart}</mark>`
		}
		return match
	})

	return processedText
}

/**
 * Syncs scroll position between the textarea and the highlight layer.
 */
export function syncHighlightScroll(textArea: HTMLTextAreaElement, highlightLayer: HTMLDivElement): void {
	highlightLayer.scrollTop = textArea.scrollTop
	highlightLayer.scrollLeft = textArea.scrollLeft
}
