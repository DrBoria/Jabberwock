export interface ExtractTextResult {
	/** The extracted content with line numbers */
	content: string
	/** Total lines in the file */
	totalLines: number
	/** Lines actually returned */
	returnedLines: number
	/** Whether output was truncated */
	wasTruncated: boolean
	/** Line range shown [start, end] (1-based) */
	linesShown?: [number, number]
}
