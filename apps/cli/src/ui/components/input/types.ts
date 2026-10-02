export interface MultilineTextInputProps {
	value: string
	onChange: (value: string) => void
	onSubmit?: (value: string) => void
	onEscape?: () => void
	onUpAtFirstLine?: () => void
	onDownAtLastLine?: () => void
	placeholder?: string
	isActive?: boolean
	showCursor?: boolean
	prompt?: string
	columns?: number
}

export interface CursorInfo {
	hasCursor: boolean
	cursorColInRow: number
}

export interface VisualRow {
	text: string
	logicalLineIndex: number
	isFirstRowOfLine: boolean
	startCol: number
}
