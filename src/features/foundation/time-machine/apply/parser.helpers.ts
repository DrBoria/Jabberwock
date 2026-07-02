import {
	ADD_FILE_MARKER,
	BEGIN_PATCH_MARKER,
	DELETE_FILE_MARKER,
	END_PATCH_MARKER,
	MOVE_TO_MARKER,
	UPDATE_FILE_MARKER,
} from "./parser.constants"
import { ParseError } from "./parser.types"
import type { Hunk } from "./parser.types"
import { parseChunks } from "./parser.parse-chunks"

/**
 * Check if lines start and end with correct patch markers.
 */
export function checkPatchBoundaries(lines: string[]): void {
	if (lines.length === 0) {
		throw new ParseError("Empty patch")
	}

	const firstLine = lines[0]?.trim()
	const lastLine = lines[lines.length - 1]?.trim()

	if (firstLine !== BEGIN_PATCH_MARKER) {
		throw new ParseError("The first line of the patch must be '*** Begin Patch'")
	}

	if (lastLine !== END_PATCH_MARKER) {
		throw new ParseError("The last line of the patch must be '*** End Patch'")
	}
}

/**
 * Parse a single hunk (file operation) from lines.
 * Returns the parsed hunk and number of lines consumed.
 */
export function parseOneHunk(lines: string[], lineNumber: number): { hunk: Hunk; linesConsumed: number } {
	const firstLine = lines[0]?.trim()

	if (firstLine?.startsWith(ADD_FILE_MARKER)) {
		return parseAddFileHunk(lines, firstLine, lineNumber)
	}

	if (firstLine?.startsWith(DELETE_FILE_MARKER)) {
		return parseDeleteFileHunk(firstLine, lineNumber)
	}

	if (firstLine?.startsWith(UPDATE_FILE_MARKER)) {
		return parseUpdateFileHunk(lines, firstLine, lineNumber)
	}

	throw new ParseError(
		`'${firstLine}' is not a valid hunk header. Valid hunk headers: '*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'`,
		lineNumber,
	)
}

function parseAddFileHunk(
	lines: string[],
	firstLine: string,
	_lineNumber: number,
): { hunk: Hunk; linesConsumed: number } {
	const path = firstLine.substring(ADD_FILE_MARKER.length)
	let contents = ""
	let parsedLines = 1

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i]
		if (line?.startsWith("+")) {
			contents += line.substring(1) + "\n"
			parsedLines++
		} else {
			break
		}
	}

	return {
		hunk: { type: "AddFile", path, contents },
		linesConsumed: parsedLines,
	}
}

function parseDeleteFileHunk(firstLine: string, _lineNumber: number): { hunk: Hunk; linesConsumed: number } {
	const path = firstLine.substring(DELETE_FILE_MARKER.length)
	return {
		hunk: { type: "DeleteFile", path },
		linesConsumed: 1,
	}
}

function parseUpdateFileHunk(
	lines: string[],
	firstLine: string,
	lineNumber: number,
): { hunk: Hunk; linesConsumed: number } {
	const path = firstLine.substring(UPDATE_FILE_MARKER.length)
	let remainingLines = lines.slice(1)
	let parsedLines = 1

	let movePath: string | null = null
	if (remainingLines[0]?.startsWith(MOVE_TO_MARKER)) {
		movePath = remainingLines[0].substring(MOVE_TO_MARKER.length)
		remainingLines = remainingLines.slice(1)
		parsedLines++
	}

	const chunks = parseChunks(remainingLines, lineNumber, parsedLines)

	if (chunks.length === 0) {
		throw new ParseError(`Update file hunk for path '${path}' is empty`, lineNumber)
	}

	return {
		hunk: { type: "UpdateFile", path, movePath, chunks },
		linesConsumed: parsedLines,
	}
}
