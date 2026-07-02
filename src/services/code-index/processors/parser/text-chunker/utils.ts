import { createHash } from "crypto"

import { CodeBlock } from "@services/code-index/interfaces"
import { MIN_BLOCK_CHARS, MIN_CHUNK_REMAINDER_CHARS } from "@services/code-index/constants"

function createSegmentHash(
	filePath: string,
	startLine: number,
	endLine: number,
	contentLength: number,
	contentPreview: string,
): string {
	return createHash("sha256")
		.update(`${filePath}-${startLine}-${endLine}-${contentLength}-${contentPreview}`)
		.digest("hex")
}

export function createSegmentBlock(
	chunks: CodeBlock[],
	segment: string,
	originalLineNumber: number,
	startCharIndex: number,
	filePath: string,
	fileHash: string,
	chunkType: string,
	seenSegmentHashes: Set<string>,
): void {
	const segmentPreview = segment.slice(0, 100)
	const segmentHash = createHash("sha256")
		.update(
			`${filePath}-${originalLineNumber}-${originalLineNumber}-${startCharIndex}-${segment.length}-${segmentPreview}`,
		)
		.digest("hex")

	if (seenSegmentHashes.has(segmentHash)) {
		return
	}

	seenSegmentHashes.add(segmentHash)

	chunks.push({
		file_path: filePath,
		identifier: null,
		type: `${chunkType}_segment`,
		start_line: originalLineNumber,
		end_line: originalLineNumber,
		content: segment,
		segmentHash,
		fileHash,
	})
}

export function finalizeChunk(
	chunks: CodeBlock[],
	currentChunkLines: string[],
	currentChunkLength: number,
	chunkStartLineIndex: number,
	endLineIndex: number,
	filePath: string,
	fileHash: string,
	chunkType: string,
	seenSegmentHashes: Set<string>,
	baseStartLine: number,
): void {
	const meetsMinChars = currentChunkLength >= MIN_BLOCK_CHARS && currentChunkLines.length > 0
	if (!meetsMinChars) {
		return
	}

	const chunkContent = currentChunkLines.join("\n")
	const startLine = baseStartLine + chunkStartLineIndex
	const endLine = baseStartLine + endLineIndex
	const contentPreview = chunkContent.slice(0, 100)
	const segmentHash = createSegmentHash(filePath, startLine, endLine, chunkContent.length, contentPreview)

	if (seenSegmentHashes.has(segmentHash)) {
		return
	}

	seenSegmentHashes.add(segmentHash)
	chunks.push({
		file_path: filePath,
		identifier: null,
		type: chunkType,
		start_line: startLine,
		end_line: endLine,
		content: chunkContent,
		segmentHash,
		fileHash,
	})
}

export function calculateRemainderLength(lines: string[], startIndex: number): number {
	let remainderLength = 0
	for (let j = startIndex; j < lines.length; j++) {
		remainderLength += lines[j].length + (j < lines.length - 1 ? 1 : 0)
	}
	return remainderLength
}

export function findRebalanceSplitIndex(
	lines: string[],
	chunkStartLineIndex: number,
	currentIndex: number,
): number | undefined {
	for (let k = currentIndex - 2; k >= chunkStartLineIndex; k--) {
		const potentialChunkLines = lines.slice(chunkStartLineIndex, k + 1)
		const potentialChunkLength = potentialChunkLines.join("\n").length + 1
		const potentialNextChunkLines = lines.slice(k + 1)
		const potentialNextChunkLength = potentialNextChunkLines.join("\n").length + 1

		const meetsMin = potentialChunkLength >= MIN_BLOCK_CHARS
		const remainderSufficient = potentialNextChunkLength >= MIN_CHUNK_REMAINDER_CHARS
		if (meetsMin && remainderSufficient) {
			return k
		}
	}
	return undefined
}
