import { Box, Text } from "ink"

import type { VisualRow } from "./multilineTextInput.types.js"
import { getCursorInfo } from "./multilineInputHandlers.js"

export function RowPrefix({
	prompt,
	showPrompt,
	promptWidth,
}: {
	prompt: string
	showPrompt: boolean
	promptWidth: number
}) {
	return <Box width={promptWidth}>{showPrompt && <Text>{prompt}</Text>}</Box>
}

export function renderVisualRowContent(
	row: VisualRow,
	rowIndex: number,
	prompt: string,
	cursorPosition: { line: number; col: number } | null,
	visualRows: VisualRow[],
	isActive: boolean,
	value: string,
	columns: number | undefined,
) {
	const isPlaceholder = !value && !isActive && row.logicalLineIndex === 0
	const promptWidth = prompt.length
	const showPrompt = row.logicalLineIndex === 0 && row.isFirstRowOfLine
	const { hasCursor, cursorColInRow } = getCursorInfo(row, cursorPosition, visualRows, rowIndex, isActive)
	if (!hasCursor)
		return (
			<Box key={rowIndex} flexDirection="row">
				<RowPrefix prompt={prompt} showPrompt={showPrompt} promptWidth={promptWidth} />
				<Text dimColor={isPlaceholder}>{row.text.length === 0 ? " " : row.text}</Text>
			</Box>
		)
	const cursorChar = cursorColInRow < row.text.length ? row.text[cursorColInRow] : " "
	if (columns !== undefined && promptWidth + row.text.length + 1 > columns && cursorColInRow >= row.text.length)
		return (
			<Box key={rowIndex} flexDirection="row">
				<RowPrefix prompt={prompt} showPrompt={showPrompt} promptWidth={promptWidth} />
				<Text>{row.text}</Text>
			</Box>
		)
	return (
		<Box key={rowIndex} flexDirection="row">
			<RowPrefix prompt={prompt} showPrompt={showPrompt} promptWidth={promptWidth} />
			<Text>{row.text.slice(0, cursorColInRow)}</Text>
			<Text inverse>{cursorChar}</Text>
			<Text>{row.text.slice(cursorColInRow + 1)}</Text>
		</Box>
	)
}
