import { CHANGE_CONTEXT_MARKER, EMPTY_CHANGE_CONTEXT_MARKER, EOF_MARKER } from "./parser.constants"
import { ParseError } from "./parser.types"
import type { UpdateFileChunk } from "./parser.types"

export function parseUpdateFileChunk(
	lines: string[],
	lineNumber: number,
	allowMissingContext: boolean,
): { chunk: UpdateFileChunk; linesConsumed: number } {
	if (lines.length === 0) {
		throw new ParseError("Update hunk does not contain any lines", lineNumber)
	}

	const { changeContext, startIndex } = resolveChangeContext(lines, lineNumber, allowMissingContext)

	if (startIndex >= lines.length) {
		throw new ParseError("Update hunk does not contain any lines", lineNumber + 1)
	}

	const chunk: UpdateFileChunk = {
		changeContext,
		oldLines: [],
		newLines: [],
		isEndOfFile: false,
	}

	const parsedLines = parseChunkLines(lines, startIndex, lineNumber, chunk)

	return { chunk, linesConsumed: parsedLines + startIndex }
}

function resolveChangeContext(
	lines: string[],
	lineNumber: number,
	allowMissingContext: boolean,
): { changeContext: string | null; startIndex: number } {
	if (lines[0] === EMPTY_CHANGE_CONTEXT_MARKER) {
		return { changeContext: null, startIndex: 1 }
	}

	if (lines[0]?.startsWith(CHANGE_CONTEXT_MARKER)) {
		return {
			changeContext: lines[0].substring(CHANGE_CONTEXT_MARKER.length),
			startIndex: 1,
		}
	}

	if (!allowMissingContext) {
		throw new ParseError(`Expected update hunk to start with a @@ context marker, got: '${lines[0]}'`, lineNumber)
	}

	return { changeContext: null, startIndex: 0 }
}

function parseChunkLines(lines: string[], startIndex: number, lineNumber: number, chunk: UpdateFileChunk): number {
	let parsedLines = 0

	for (let i = startIndex; i < lines.length; i++) {
		const line = lines[i]

		if (line === EOF_MARKER) {
			if (parsedLines === 0) {
				throw new ParseError("Update hunk does not contain any lines", lineNumber + 1)
			}
			chunk.isEndOfFile = true
			parsedLines++
			break
		}

		if (!processChunkLine(line, chunk, lineNumber, parsedLines)) {
			return parsedLines
		}
		parsedLines++
	}

	return parsedLines
}

function processChunkLine(line: string, chunk: UpdateFileChunk, _lineNumber: number, parsedLines: number): boolean {
	if (line === "") {
		chunk.oldLines.push("")
		chunk.newLines.push("")
		return true
	}

	const firstChar = line.charAt(0)

	if (firstChar === " ") {
		chunk.oldLines.push(line.substring(1))
		chunk.newLines.push(line.substring(1))
		return true
	}

	if (firstChar === "+") {
		chunk.newLines.push(line.substring(1))
		return true
	}

	if (firstChar === "-") {
		chunk.oldLines.push(line.substring(1))
		return true
	}

	if (parsedLines === 0) {
		throw new ParseError(
			`Unexpected line found in update hunk: '${line}'. Every line should start with ' ' (context line), '+' (added line), or '-' (removed line)`,
			_lineNumber + 1,
		)
	}

	return false
}

export function parseChunks(remainingLines: string[], lineNumber: number, parsedLines: number): UpdateFileChunk[] {
	const chunks: UpdateFileChunk[] = []
	let localRemaining = remainingLines
	let localParsed = parsedLines

	while (localRemaining.length > 0) {
		if (localRemaining[0]?.trim() === "") {
			localParsed++
			localRemaining = localRemaining.slice(1)
			continue
		}

		if (localRemaining[0]?.startsWith("***")) {
			break
		}

		const { chunk, linesConsumed } = parseUpdateFileChunk(
			localRemaining,
			lineNumber + localParsed,
			chunks.length === 0,
		)
		chunks.push(chunk)
		localParsed += linesConsumed
		localRemaining = localRemaining.slice(linesConsumed)
	}

	return chunks
}
