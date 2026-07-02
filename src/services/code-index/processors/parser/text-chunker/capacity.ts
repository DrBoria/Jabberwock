import { CodeBlock } from "@services/code-index/interfaces"
import { MAX_BLOCK_CHARS, MIN_BLOCK_CHARS, MIN_CHUNK_REMAINDER_CHARS } from "@services/code-index/constants"

import { calculateRemainderLength, createSegmentBlock, finalizeChunk, findRebalanceSplitIndex } from "./utils"

export function handleOversizedLine(
	line: string,
	lineIndex: number,
	originalLineNumber: number,
	chunkStartLineIndex: number,
	currentChunkLines: string[],
	currentChunkLength: number,
	chunks: CodeBlock[],
	filePath: string,
	fileHash: string,
	chunkType: string,
	seenSegmentHashes: Set<string>,
	baseStartLine: number,
): { currentChunkLines: string[]; currentChunkLength: number; chunkStartLineIndex: number } {
	if (currentChunkLines.length > 0) {
		finalizeChunk(
			chunks,
			currentChunkLines,
			currentChunkLength,
			chunkStartLineIndex,
			lineIndex - 1,
			filePath,
			fileHash,
			chunkType,
			seenSegmentHashes,
			baseStartLine,
		)
		currentChunkLines = []
		currentChunkLength = 0
	}

	let remainingLineContent = line
	let currentSegmentStartChar = 0
	while (remainingLineContent.length > 0) {
		const segment = remainingLineContent.substring(0, MAX_BLOCK_CHARS)
		remainingLineContent = remainingLineContent.substring(MAX_BLOCK_CHARS)
		createSegmentBlock(
			chunks,
			segment,
			originalLineNumber,
			currentSegmentStartChar,
			filePath,
			fileHash,
			chunkType,
			seenSegmentHashes,
		)
		currentSegmentStartChar += MAX_BLOCK_CHARS
	}

	return {
		currentChunkLines,
		currentChunkLength,
		chunkStartLineIndex: lineIndex + 1,
	}
}

export function handleExceedsCapacity(
	lines: string[],
	lineIndex: number,
	line: string,
	lineLength: number,
	chunkStartLineIndex: number,
	currentChunkLines: string[],
	currentChunkLength: number,
	_effectiveMaxChars: number,
	chunks: CodeBlock[],
	filePath: string,
	fileHash: string,
	chunkType: string,
	seenSegmentHashes: Set<string>,
	baseStartLine: number,
): { currentChunkLines: string[]; currentChunkLength: number; chunkStartLineIndex: number; nextIndex: number } {
	let splitIndex = lineIndex - 1
	const remainderLength = calculateRemainderLength(lines, lineIndex)

	const needsRebalance =
		currentChunkLength >= MIN_BLOCK_CHARS &&
		remainderLength < MIN_CHUNK_REMAINDER_CHARS &&
		currentChunkLines.length > 1
	if (needsRebalance) {
		const rebalanceSplitIndex = findRebalanceSplitIndex(lines, chunkStartLineIndex, lineIndex)
		if (rebalanceSplitIndex !== undefined) {
			splitIndex = rebalanceSplitIndex
		}
	}

	finalizeChunk(
		chunks,
		currentChunkLines,
		currentChunkLength,
		chunkStartLineIndex,
		splitIndex,
		filePath,
		fileHash,
		chunkType,
		seenSegmentHashes,
		baseStartLine,
	)

	const nextIndex = lineIndex >= chunkStartLineIndex ? lineIndex : chunkStartLineIndex - 1
	const newChunkLines = lineIndex >= chunkStartLineIndex ? [line] : []
	const newChunkLength = lineIndex >= chunkStartLineIndex ? lineLength : 0

	return {
		currentChunkLines: newChunkLines,
		currentChunkLength: newChunkLength,
		chunkStartLineIndex: splitIndex + 1,
		nextIndex,
	}
}
