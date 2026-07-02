import { distance } from "fastest-levenshtein"

import type { DiffResult } from "@shared/tools"

import { addLineNumbers, everyLineHasLineNumbers, stripLineNumbers } from "@integrations/misc/extract-text/helpers"
import { normalizeString } from "@utils/text"

export function checkAllLinesHaveNumbers(searchContent: string, replaceContent: string): boolean {
	return (
		(everyLineHasLineNumbers(searchContent) && everyLineHasLineNumbers(replaceContent)) ||
		(everyLineHasLineNumbers(searchContent) && replaceContent.trim() === "")
	)
}

export function getSimilarity(original: string, search: string): number {
	if (search === "") {
		return 0
	}

	const normalizedOriginal = normalizeString(original)
	const normalizedSearch = normalizeString(search)

	if (normalizedOriginal === normalizedSearch) {
		return 1
	}

	const dist = distance(normalizedOriginal, normalizedSearch)
	const maxLength = Math.max(normalizedOriginal.length, normalizedSearch.length)
	return 1 - dist / maxLength
}

export function fuzzySearch(lines: string[], searchChunk: string, startIndex: number, endIndex: number) {
	let bestScore = 0
	let bestMatchIndex = -1
	let bestMatchContent = ""
	const searchLen = searchChunk.split(/\r?\n/).length

	const midPoint = Math.floor((startIndex + endIndex) / 2)
	let leftIndex = midPoint
	let rightIndex = midPoint + 1

	while (leftIndex >= startIndex || rightIndex <= endIndex - searchLen) {
		if (leftIndex >= startIndex) {
			const originalChunk = lines.slice(leftIndex, leftIndex + searchLen).join("\n")
			const similarity = getSimilarity(originalChunk, searchChunk)
			if (similarity > bestScore) {
				bestScore = similarity
				bestMatchIndex = leftIndex
				bestMatchContent = originalChunk
			}
			leftIndex--
		}

		if (rightIndex <= endIndex - searchLen) {
			const originalChunk = lines.slice(rightIndex, rightIndex + searchLen).join("\n")
			const similarity = getSimilarity(originalChunk, searchChunk)
			if (similarity > bestScore) {
				bestScore = similarity
				bestMatchIndex = rightIndex
				bestMatchContent = originalChunk
			}
			rightIndex++
		}
	}

	return { bestScore, bestMatchIndex, bestMatchContent }
}

export function computeIndentedReplaceLines(
	matchedLines: string[],
	searchLines: string[],
	replaceContent: string,
): string[] {
	const replaceLines = replaceContent === "" ? [] : replaceContent.split(/\r?\n/)

	const originalIndents = matchedLines.map((line) => {
		const match = line.match(/^[\t ]*/)
		return match ? match[0] : ""
	})

	const searchIndents = searchLines.map((line) => {
		const match = line.match(/^[\t ]*/)
		return match ? match[0] : ""
	})

	return replaceLines.map((line) => {
		const matchedIndent = originalIndents[0] || ""
		const currentIndentMatch = line.match(/^[\t ]*/)
		const currentIndent = currentIndentMatch ? currentIndentMatch[0] : ""
		const searchBaseIndent = searchIndents[0] || ""
		const searchBaseLevel = searchBaseIndent.length
		const currentLevel = currentIndent.length
		const relativeLevel = currentLevel - searchBaseLevel
		const finalIndent =
			relativeLevel < 0
				? matchedIndent.slice(0, Math.max(0, matchedIndent.length + relativeLevel))
				: matchedIndent + currentIndent.slice(searchBaseLevel)
		return finalIndent + line.trim()
	})
}

export function pushNoMatchError(
	resultLines: string[],
	searchChunk: string,
	startLine: number,
	originalStartLine: number,
	matchIndex: number,
	bestMatchScore: number,
	bestMatchContent: string,
	bufferLines: number,
	fuzzyThreshold: number,
): DiffResult {
	const originalContentSection =
		startLine !== undefined && startLine !== 0
			? `\n\nOriginal Content:\n${addLineNumbers(
					resultLines
						.slice(
							Math.max(0, startLine - 1 - bufferLines),
							Math.min(resultLines.length, startLine + searchChunk.split("\n").length + bufferLines),
						)
						.join("\n"),
					Math.max(1, startLine - bufferLines),
				)}`
			: `\n\nOriginal Content:\n${addLineNumbers(resultLines.join("\n"))}`

	const bestMatchSection = bestMatchContent
		? `\n\nBest Match Found:\n${addLineNumbers(bestMatchContent, matchIndex + 1)}`
		: `\n\nBest Match Found:\n(no match)`

	const lineRange = originalStartLine ? ` at line: ${originalStartLine}` : ""

	return {
		success: false,
		error: `No sufficiently similar match found${lineRange} (${Math.floor(bestMatchScore * 100)}% similar, needs ${Math.floor(fuzzyThreshold * 100)}%)\n\nDebug Info:\n- Similarity Score: ${Math.floor(bestMatchScore * 100)}%\n- Required Threshold: ${Math.floor(fuzzyThreshold * 100)}%\n- Search Range: ${originalStartLine ? `starting at line ${originalStartLine}` : "start to end"}\n- Tried both standard and aggressive line number stripping\n- Tip: Use the read_file tool to get the latest content of the file before attempting to use the apply_diff tool again, as the file content may have changed\n\nSearch Content:\n${searchChunk}${bestMatchSection}${originalContentSection}`,
	}
}
