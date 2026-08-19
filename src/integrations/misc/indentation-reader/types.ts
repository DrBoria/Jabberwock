export interface LineRecord {
	/** 1-based line number */
	lineNumber: number
	/** Original line content */
	content: string
	/** Computed indentation level (number of leading whitespace units) */
	indentLevel: number
	/** Whether this line is blank (empty or whitespace only) */
	isBlank: boolean
	/** Whether this line starts a new block (has content followed by colon, brace, etc.) */
	isBlockStart: boolean
}

export interface IndentationReadOptions {
	/** 1-based anchor line number */
	anchorLine: number
	/** Maximum indentation levels to include above anchor (0 = unlimited, default: 0) */
	maxLevels?: number
	/** Include sibling blocks at the same indentation level (default: false) */
	includeSiblings?: boolean
	/** Include file header content (imports, comments at top) (default: true) */
	includeHeader?: boolean
	/** Maximum lines to return from bidirectional expansion (default: 2000) */
	limit?: number
	/** Hard cap on lines returned, separate from limit (optional) */
	maxLines?: number
}

export interface IndentationReadResult {
	/** The extracted content with line numbers */
	content: string
	/** Line ranges that were included [start, end] tuples (1-based) */
	includedRanges: Array<[number, number]>
	/** Total lines in the file */
	totalLines: number
	/** Lines actually returned */
	returnedLines: number
	/** Whether output was truncated due to limit */
	wasTruncated: boolean
}

export interface ExpandStepResult {
	progressed: boolean
	nextI?: number
	nextJ?: number
	nextCount: number
}
