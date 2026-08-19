import { stripLineNumbers } from "@integrations/misc/extract-text/helpers"

import { fuzzySearch, getSimilarity, computeIndentedReplaceLines, pushNoMatchError } from "./multi-search-replace-fuzzy"

export function findMatchInLines(
	resultLines: string[],
	searchLines: string[],
	searchContent: string,
	replaceContent: string,
	startLine: number,
	originalStartLine: number,
	bufferLines: number,
	fuzzyThreshold: number,
): { matchIndex: number; matchedLines: string[]; indentedReplaceLines: string[] } | undefined {
	let matchIndex = -1
	let bestMatchScore = 0
	let bestMatchContent = ""
	const searchChunk = searchLines.join("\n")

	let searchStartIndex = 0
	let searchEndIndex = resultLines.length

	if (startLine) {
		const exactStartIndex = startLine - 1
		const searchLen = searchLines.length
		const exactEndIndex = exactStartIndex + searchLen - 1
		const originalChunk = resultLines.slice(exactStartIndex, exactEndIndex + 1).join("\n")
		const similarity = getSimilarity(originalChunk, searchChunk)

		if (similarity >= fuzzyThreshold) {
			matchIndex = exactStartIndex
			bestMatchScore = similarity
			bestMatchContent = originalChunk
		} else {
			searchStartIndex = Math.max(0, startLine - (bufferLines + 1))
			searchEndIndex = Math.min(resultLines.length, startLine + searchLines.length + bufferLines)
		}
	}

	if (matchIndex === -1) {
		const fuzzyResult = fuzzySearch(resultLines, searchChunk, searchStartIndex, searchEndIndex)
		matchIndex = fuzzyResult.bestMatchIndex
		bestMatchScore = fuzzyResult.bestScore
		bestMatchContent = fuzzyResult.bestMatchContent
	}

	if (matchIndex === -1 || bestMatchScore < fuzzyThreshold) {
		const result = tryAggressiveMatch(
			resultLines,
			searchContent,
			replaceContent,
			searchChunk,
			startLine,
			originalStartLine,
			matchIndex,
			bestMatchScore,
			bestMatchContent,
			searchStartIndex,
			searchEndIndex,
			bufferLines,
			fuzzyThreshold,
		)
		if (!result?.matchIndex && result?.matchIndex !== 0) {
			return undefined
		}
		return result
	}

	const matchedLines = resultLines.slice(matchIndex, matchIndex + searchLines.length)
	const indentedReplaceLines = computeIndentedReplaceLines(matchedLines, searchLines, replaceContent)

	return { matchIndex, matchedLines, indentedReplaceLines }
}

function tryAggressiveMatch(
	resultLines: string[],
	searchContent: string,
	replaceContent: string,
	searchChunk: string,
	startLine: number,
	originalStartLine: number,
	matchIndex: number,
	bestMatchScore: number,
	bestMatchContent: string,
	searchStartIndex: number,
	searchEndIndex: number,
	bufferLines: number,
	fuzzyThreshold: number,
): { matchIndex: number; matchedLines: string[]; indentedReplaceLines: string[] } | undefined {
	const aggressiveSearchContent = stripLineNumbers(searchContent, true)
	const aggressiveReplaceContent = stripLineNumbers(replaceContent, true)

	const aggressiveSearchLines = aggressiveSearchContent ? aggressiveSearchContent.split(/\r?\n/) : []
	const aggressiveSearchChunk = aggressiveSearchLines.join("\n")

	const fuzzyResult = fuzzySearch(resultLines, aggressiveSearchChunk, searchStartIndex, searchEndIndex)

	if (fuzzyResult.bestMatchIndex !== -1 && fuzzyResult.bestScore >= fuzzyThreshold) {
		const matchedLines = resultLines.slice(
			fuzzyResult.bestMatchIndex,
			fuzzyResult.bestMatchIndex + aggressiveSearchLines.length,
		)
		const indentedReplaceLines = computeIndentedReplaceLines(
			matchedLines,
			aggressiveSearchLines,
			aggressiveReplaceContent,
		)
		return { matchIndex: fuzzyResult.bestMatchIndex, matchedLines, indentedReplaceLines }
	}

	pushNoMatchError(
		resultLines,
		searchChunk,
		startLine,
		originalStartLine,
		matchIndex,
		bestMatchScore,
		bestMatchContent,
		bufferLines,
		fuzzyThreshold,
	)
	return undefined
}
