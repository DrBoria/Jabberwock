import { CodeBlock } from "@services/code-index/interfaces"
import { MAX_BLOCK_CHARS, MAX_CHARS_TOLERANCE_FACTOR } from "@services/code-index/constants"

import { finalizeChunk } from "./utils"
import { handleExceedsCapacity, handleOversizedLine } from "./capacity"

export interface ChunkingContext {
	loadedParsers: Record<string, unknown>
	ensureParserLoaded: (ext: string, filePath: string) => Promise<unknown>
}

const effectiveMaxChars = MAX_BLOCK_CHARS * MAX_CHARS_TOLERANCE_FACTOR

export function chunkTextByLines(
	lines: string[],
	filePath: string,
	fileHash: string,
	chunkType: string,
	seenSegmentHashes: Set<string>,
	baseStartLine: number = 1,
): CodeBlock[] {
	const chunks: CodeBlock[] = []
	let currentChunkLines: string[] = []
	let currentChunkLength = 0
	let chunkStartLineIndex = 0

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		const lineLength = line.length + (i < lines.length - 1 ? 1 : 0)
		const originalLineNumber = baseStartLine + i

		const isOversizedLine = lineLength > effectiveMaxChars
		if (isOversizedLine) {
			const oversizedResult = handleOversizedLine(
				line,
				i,
				originalLineNumber,
				chunkStartLineIndex,
				currentChunkLines,
				currentChunkLength,
				chunks,
				filePath,
				fileHash,
				chunkType,
				seenSegmentHashes,
				baseStartLine,
			)
			currentChunkLines = oversizedResult.currentChunkLines
			currentChunkLength = oversizedResult.currentChunkLength
			chunkStartLineIndex = oversizedResult.chunkStartLineIndex
			continue
		}

		const exceedsChunkCapacity = currentChunkLength > 0 && currentChunkLength + lineLength > effectiveMaxChars
		if (exceedsChunkCapacity) {
			const capacityResult = handleExceedsCapacity(
				lines,
				i,
				line,
				lineLength,
				chunkStartLineIndex,
				currentChunkLines,
				currentChunkLength,
				effectiveMaxChars,
				chunks,
				filePath,
				fileHash,
				chunkType,
				seenSegmentHashes,
				baseStartLine,
			)
			currentChunkLines = capacityResult.currentChunkLines
			currentChunkLength = capacityResult.currentChunkLength
			chunkStartLineIndex = capacityResult.chunkStartLineIndex
			i = capacityResult.nextIndex
			continue
		}

		currentChunkLines.push(line)
		currentChunkLength += lineLength
	}

	if (currentChunkLines.length > 0) {
		finalizeChunk(
			chunks,
			currentChunkLines,
			currentChunkLength,
			chunkStartLineIndex,
			lines.length - 1,
			filePath,
			fileHash,
			chunkType,
			seenSegmentHashes,
			baseStartLine,
		)
	}

	return chunks
}
