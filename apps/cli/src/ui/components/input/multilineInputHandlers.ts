import type { Key } from "ink"

import type { CursorInfo, VisualRow } from "./multilineTextInput.types.js"
import {
	handleArrowUpKey,
	handleArrowDownKey,
	handleArrowLeftKey,
	handleArrowRightKey,
} from "./multilineInputHandlers.arrows.js"

export function normalizeLineEndings(text: string): string {
	if (text == null) return ""
	return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
}

export function getCursorPosition(value: string, cursorIndex: number): { line: number; col: number } {
	const lines = value.split("\n")
	let pos = 0
	for (let i = 0; i < lines.length; i++) {
		const lineEnd = pos + lines[i]!.length
		if (cursorIndex <= lineEnd) return { line: i, col: cursorIndex - pos }
		pos = lineEnd + 1
	}
	return { line: lines.length - 1, col: (lines[lines.length - 1] || "").length }
}

export function getIndexFromPosition(value: string, line: number, col: number): number {
	const lines = value.split("\n")
	let index = 0
	for (let i = 0; i < line && i < lines.length; i++) index += lines[i]!.length + 1
	return index + Math.min(col, (lines[line] || "").length)
}

export function wrapLine(lineText: string, logicalLineIndex: number, availableWidth: number): VisualRow[] {
	if (availableWidth <= 0 || lineText.length < availableWidth)
		return [{ text: lineText, logicalLineIndex, isFirstRowOfLine: true, startCol: 0 }]
	const rows: VisualRow[] = []
	let remaining = lineText,
		startCol = 0,
		isFirst = true
	while (remaining.length > 0) {
		if (remaining.length < availableWidth) {
			rows.push({ text: remaining, logicalLineIndex, isFirstRowOfLine: isFirst, startCol })
			break
		}
		let breakPoint = availableWidth
		for (let i = Math.min(availableWidth, remaining.length) - 1; i >= 0; i--) {
			if (remaining[i] === " ") {
				breakPoint = i + 1
				break
			}
		}
		rows.push({ text: remaining.slice(0, breakPoint), logicalLineIndex, isFirstRowOfLine: isFirst, startCol })
		remaining = remaining.slice(breakPoint)
		startCol += breakPoint
		isFirst = false
	}
	return rows
}

export function isKittyEnter(input: string): boolean {
	return (
		input === "\x1b[13;2u" ||
		input === "\x1b[27;2;13~" ||
		input === "\x1b\r" ||
		input === "\x1bOM" ||
		(input.startsWith("\x1b[") && input.includes(";2") && input.endsWith("u"))
	)
}

export function isModifiedEnterSequence(input: string, key: Key): boolean {
	if (input === "\r" && !key.return) return true
	if (key.return && key.shift === true) return true
	return isKittyEnter(input)
}

export function handleModifiedEnterKey(
	currentValue: string,
	currentCursorIndex: number,
	onChange: (value: string) => void,
	valueRef: React.MutableRefObject<string>,
	cursorIndexRef: React.MutableRefObject<number>,
	setCursorIndex: (index: number) => void,
) {
	const newValue = currentValue.slice(0, currentCursorIndex) + "\n" + currentValue.slice(currentCursorIndex)
	const newCursorIndex = currentCursorIndex + 1
	valueRef.current = newValue
	cursorIndexRef.current = newCursorIndex
	onChange(newValue)
	setCursorIndex(newCursorIndex)
}

export function handleBackspaceKey(
	currentValue: string,
	currentCursorIndex: number,
	onChange: (value: string) => void,
	valueRef: React.MutableRefObject<string>,
	cursorIndexRef: React.MutableRefObject<number>,
	setCursorIndex: (index: number) => void,
) {
	if (currentCursorIndex <= 0) return
	const newValue = currentValue.slice(0, currentCursorIndex - 1) + currentValue.slice(currentCursorIndex)
	valueRef.current = newValue
	cursorIndexRef.current = currentCursorIndex - 1
	onChange(newValue)
	setCursorIndex(currentCursorIndex - 1)
}

export function handleCharacterInput(
	input: string,
	currentValue: string,
	currentCursorIndex: number,
	onChange: (value: string) => void,
	valueRef: React.MutableRefObject<string>,
	cursorIndexRef: React.MutableRefObject<number>,
	setCursorIndex: (index: number) => void,
) {
	const normalized = normalizeLineEndings(input)
	const newValue = currentValue.slice(0, currentCursorIndex) + normalized + currentValue.slice(currentCursorIndex)
	valueRef.current = newValue
	cursorIndexRef.current = currentCursorIndex + normalized.length
	onChange(newValue)
	setCursorIndex(cursorIndexRef.current)
}

export function getCursorInfo(
	row: VisualRow,
	cursorPosition: { line: number; col: number } | null,
	visualRows: VisualRow[],
	rowIndex: number,
	isActive: boolean,
): CursorInfo {
	if (cursorPosition === null || !isActive) return { hasCursor: false, cursorColInRow: -1 }
	if (cursorPosition.line !== row.logicalLineIndex) return { hasCursor: false, cursorColInRow: -1 }
	const cursorCol = cursorPosition.col
	if (cursorCol >= row.startCol && cursorCol < row.startCol + row.text.length)
		return { hasCursor: true, cursorColInRow: cursorCol - row.startCol }
	if (cursorCol === row.startCol + row.text.length) {
		const nextRow = visualRows[rowIndex + 1]
		if (nextRow === undefined || nextRow.logicalLineIndex !== row.logicalLineIndex)
			return { hasCursor: true, cursorColInRow: row.text.length }
	}
	return { hasCursor: false, cursorColInRow: -1 }
}

export function handleMultilineKey(
	input: string,
	key: Key,
	onChange: (value: string) => void,
	onSubmit: ((value: string) => void) | undefined,
	onUpAtFirstLine: (() => void) | undefined,
	onDownAtLastLine: (() => void) | undefined,
	showCursor: boolean,
	valueRef: React.MutableRefObject<string>,
	cursorIndexRef: React.MutableRefObject<number>,
	setCursorIndex: (index: number) => void,
) {
	const currentValue = valueRef.current
	const currentCursorIndex = cursorIndexRef.current
	if (isModifiedEnterSequence(input, key)) {
		handleModifiedEnterKey(currentValue, currentCursorIndex, onChange, valueRef, cursorIndexRef, setCursorIndex)
		return
	}
	if (key.return) {
		onSubmit?.(currentValue)
		return
	}
	if (key.upArrow) {
		handleArrowUpKey(currentValue, currentCursorIndex, showCursor, onUpAtFirstLine, cursorIndexRef, setCursorIndex)
		return
	}
	if (key.downArrow) {
		handleArrowDownKey(
			currentValue,
			currentCursorIndex,
			showCursor,
			onDownAtLastLine,
			cursorIndexRef,
			setCursorIndex,
		)
		return
	}
	if (key.leftArrow) {
		handleArrowLeftKey(currentCursorIndex, showCursor, cursorIndexRef, setCursorIndex)
		return
	}
	if (key.rightArrow) {
		handleArrowRightKey(currentValue, currentCursorIndex, showCursor, cursorIndexRef, setCursorIndex)
		return
	}
	if (key.backspace) {
		handleBackspaceKey(currentValue, currentCursorIndex, onChange, valueRef, cursorIndexRef, setCursorIndex)
		return
	}
	if (input)
		handleCharacterInput(
			input,
			currentValue,
			currentCursorIndex,
			onChange,
			valueRef,
			cursorIndexRef,
			setCursorIndex,
		)
}
