import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Box, useInput, type Key } from "ink"

import { isGlobalInputSequence } from "@/lib/utils/validation/input.js"

import type { MultilineTextInputProps, VisualRow } from "./multilineTextInput.types.js"
import { getCursorPosition, wrapLine, handleMultilineKey } from "./multilineInputHandlers.js"
import { renderVisualRowContent } from "./multilineInputRender.js"

export type { MultilineTextInputProps }

export function MultilineTextInput({
	value,
	onChange,
	onSubmit,
	onEscape,
	onUpAtFirstLine,
	onDownAtLastLine,
	placeholder = "",
	isActive = true,
	showCursor = true,
	prompt = "> ",
	columns,
}: MultilineTextInputProps) {
	const [cursorIndex, setCursorIndex] = useState(value.length)
	const valueRef = useRef(value)
	const cursorIndexRef = useRef(cursorIndex)
	const prevValuePropRef = useRef(value)
	if (value !== prevValuePropRef.current) {
		valueRef.current = value
		prevValuePropRef.current = value
	}
	cursorIndexRef.current = cursorIndex
	useEffect(() => {
		if (cursorIndex > value.length) setCursorIndex(value.length)
	}, [value, cursorIndex])
	useInput(
		(input: string, key: Key) => {
			if (key.escape) {
				onEscape?.()
				return
			}
			if (isGlobalInputSequence(input, key)) return
			handleMultilineKey(
				input,
				key,
				onChange,
				onSubmit,
				onUpAtFirstLine,
				onDownAtLastLine,
				showCursor,
				valueRef,
				cursorIndexRef,
				setCursorIndex,
			)
		},
		{ isActive },
	)
	const lines = useMemo(() => {
		if (!value && !isActive) return [placeholder]
		if (!value) return [""]
		return value.split("\n")
	}, [value, placeholder, isActive])
	const cursorPosition = useMemo(() => {
		if (!showCursor || !isActive) return null
		return getCursorPosition(value, cursorIndex)
	}, [value, cursorIndex, showCursor, isActive])
	const visualRows = useMemo(() => {
		const rows: VisualRow[] = []
		const promptLen = prompt.length
		for (let i = 0; i < lines.length; i++)
			rows.push(...wrapLine(lines[i]!, i, columns ? Math.max(1, columns - promptLen) : 10000))
		return rows
	}, [lines, columns, prompt.length])
	const renderVisualRow = useCallback(
		(row: VisualRow, rowIndex: number) =>
			renderVisualRowContent(row, rowIndex, prompt, cursorPosition, visualRows, isActive, value, columns),
		[prompt, cursorPosition, value, isActive, visualRows, columns],
	)
	return <Box flexDirection="column">{visualRows.map((row, index) => renderVisualRow(row, index))}</Box>
}
