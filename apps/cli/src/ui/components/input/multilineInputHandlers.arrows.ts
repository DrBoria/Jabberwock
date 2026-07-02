import { getCursorPosition, getIndexFromPosition } from "./multilineInputHandlers.js"

export function handleArrowUpKey(
	currentValue: string,
	currentCursorIndex: number,
	showCursor: boolean,
	onUpAtFirstLine: (() => void) | undefined,
	cursorIndexRef: React.MutableRefObject<number>,
	setCursorIndex: (index: number) => void,
) {
	if (!showCursor) return
	const { line, col } = getCursorPosition(currentValue, currentCursorIndex)
	if (line > 0) {
		const targetLine = currentValue.split("\n")[line - 1]!
		cursorIndexRef.current = getIndexFromPosition(currentValue, line - 1, Math.min(col, targetLine.length))
		setCursorIndex(cursorIndexRef.current)
	} else onUpAtFirstLine?.()
}

export function handleArrowDownKey(
	currentValue: string,
	currentCursorIndex: number,
	showCursor: boolean,
	onDownAtLastLine: (() => void) | undefined,
	cursorIndexRef: React.MutableRefObject<number>,
	setCursorIndex: (index: number) => void,
) {
	if (!showCursor) return
	const lines = currentValue.split("\n")
	const { line, col } = getCursorPosition(currentValue, currentCursorIndex)
	if (line < lines.length - 1) {
		const targetLine = lines[line + 1]!
		cursorIndexRef.current = getIndexFromPosition(currentValue, line + 1, Math.min(col, targetLine.length))
		setCursorIndex(cursorIndexRef.current)
	} else onDownAtLastLine?.()
}

export function handleArrowLeftKey(
	currentCursorIndex: number,
	showCursor: boolean,
	cursorIndexRef: React.MutableRefObject<number>,
	setCursorIndex: (index: number) => void,
) {
	if (!showCursor) return
	cursorIndexRef.current = Math.max(0, currentCursorIndex - 1)
	setCursorIndex(cursorIndexRef.current)
}

export function handleArrowRightKey(
	currentValue: string,
	currentCursorIndex: number,
	showCursor: boolean,
	cursorIndexRef: React.MutableRefObject<number>,
	setCursorIndex: (index: number) => void,
) {
	if (!showCursor) return
	cursorIndexRef.current = Math.min(currentValue.length, currentCursorIndex + 1)
	setCursorIndex(cursorIndexRef.current)
}
