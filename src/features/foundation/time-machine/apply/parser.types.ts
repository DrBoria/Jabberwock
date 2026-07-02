/**
 * Represents an error during patch parsing.
 */
export class ParseError extends Error {
	constructor(
		message: string,
		public lineNumber?: number,
	) {
		super(lineNumber !== undefined ? `Line ${lineNumber}: ${message}` : message)
		this.name = "ParseError"
	}
}

/**
 * A chunk within an UpdateFile hunk.
 */
export interface UpdateFileChunk {
	/** Optional context line (e.g., class or function name) to narrow search */
	changeContext: string | null
	/** Lines to find and replace (context + removed lines) */
	oldLines: string[]
	/** Lines to replace with (context + added lines) */
	newLines: string[]
	/** If true, old_lines must match at end of file */
	isEndOfFile: boolean
}

/**
 * Represents a file operation in a patch.
 */
export type Hunk =
	| {
			type: "AddFile"
			path: string
			contents: string
	  }
	| {
			type: "DeleteFile"
			path: string
	  }
	| {
			type: "UpdateFile"
			path: string
			movePath: string | null
			chunks: UpdateFileChunk[]
	  }

/**
 * Result of parsing a patch.
 */
export interface ApplyPatchArgs {
	hunks: Hunk[]
	patch: string
}
