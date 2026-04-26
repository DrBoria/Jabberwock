/**
 * Drag-and-drop handling utilities for ChatTextArea.
 * Handles file path drops and image drops.
 */

import { convertToMentionPath } from "@src/utils/path-mentions"

/**
 * Processes dropped text (file paths) and converts them to mention paths.
 * Returns the new value and cursor position.
 */
export function processDroppedText(
	text: string,
	currentValue: string,
	cursorPosition: number,
	cwd: string | undefined,
): { newValue: string; newCursorPosition: number } {
	const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "")

	if (lines.length === 0) {
		return { newValue: currentValue, newCursorPosition: cursorPosition }
	}

	let newValue = currentValue.slice(0, cursorPosition)
	let totalLength = 0

	for (let i = 0; i < lines.length; i++) {
		const mentionText = convertToMentionPath(lines[i], cwd)
		newValue += mentionText
		totalLength += mentionText.length

		if (i < lines.length - 1) {
			newValue += " "
			totalLength += 1
		}
	}

	newValue += " " + currentValue.slice(cursorPosition)
	totalLength += 1

	return { newValue, newCursorPosition: cursorPosition + totalLength }
}

/**
 * Checks if a mouse event is outside the element's bounds (for drag leave).
 */
export function isOutsideElement(e: React.DragEvent<HTMLDivElement>, element: Element): boolean {
	const rect = element.getBoundingClientRect()
	return e.clientX <= rect.left || e.clientX >= rect.right || e.clientY <= rect.top || e.clientY >= rect.bottom
}
