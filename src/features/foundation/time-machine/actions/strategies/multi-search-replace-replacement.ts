import type { DiffResult } from "@shared/tools"

import { stripLineNumbers } from "@integrations/misc/extract-text/helpers"

import { checkAllLinesHaveNumbers } from "./multi-search-replace-fuzzy"
import { pushNoMatchError } from "./multi-search-replace-fuzzy"
import { findMatchInLines } from "./multi-search-replace-find"

function unescapeMarkers(content: string): string {
	return content
		.replace(/^\\<<<<<<</gm, "<<<<<<<")
		.replace(/^\\=======/gm, "=======")
		.replace(/^\\>>>>>>>/gm, ">>>>>>>")
		.replace(/^\\-------/gm, "-------")
		.replace(/^\\:end_line:/gm, ":end_line:")
		.replace(/^\\:start_line:/gm, ":start_line:")
}

export function prepareReplacement(
	replacement: { startLine: number; searchContent: string; replaceContent: string },
	currentDelta: number,
): {
	searchContent: string
	replaceContent: string
	searchLines: string[]
	replaceLines: string[]
	startLine: number
	error?: DiffResult
} {
	let { searchContent, replaceContent } = replacement
	let startLine = replacement.startLine + (replacement.startLine === 0 ? 0 : currentDelta)

	searchContent = unescapeMarkers(searchContent)
	replaceContent = unescapeMarkers(replaceContent)

	const hasAllLineNumbers = checkAllLinesHaveNumbers(searchContent, replaceContent)

	if (hasAllLineNumbers && startLine === 0) {
		startLine = parseInt(searchContent.split("\n")[0].split("|")[0])
	}

	if (hasAllLineNumbers) {
		searchContent = stripLineNumbers(searchContent)
		replaceContent = stripLineNumbers(replaceContent)
	}

	if (searchContent === replaceContent) {
		return {
			searchContent,
			replaceContent,
			searchLines: [],
			replaceLines: [],
			startLine,
			error: {
				success: false,
				error:
					`Search and replace content are identical - no changes would be made\n\n` +
					`Debug Info:\n` +
					`- Search and replace must be different to make changes\n` +
					`- Use read_file to verify the content you want to change`,
			},
		}
	}

	const searchLines = searchContent === "" ? [] : searchContent.split(/\r?\n/)
	const replaceLines = replaceContent === "" ? [] : replaceContent.split(/\r?\n/)

	return { searchContent, replaceContent, searchLines, replaceLines, startLine }
}

export function processReplacement(
	replacement: { startLine: number; searchContent: string; replaceContent: string },
	currentLines: string[],
	currentDelta: number,
	bufferLines: number,
	fuzzyThreshold: number,
): { resultLines: string[]; delta: number; applied: boolean; diffResult?: DiffResult } {
	const prepared = prepareReplacement(replacement, currentDelta)
	if (prepared.error) {
		return {
			resultLines: currentLines,
			delta: currentDelta,
			applied: false,
			diffResult: prepared.error,
		}
	}

	const { searchLines, searchContent, replaceContent, startLine } = prepared

	if (searchLines.length === 0) {
		return {
			resultLines: currentLines,
			delta: currentDelta,
			applied: false,
			diffResult: {
				success: false,
				error: `Empty search content is not allowed\n\nDebug Info:\n- Search content cannot be empty\n- For insertions, provide a specific line using :start_line: and include content to search for\n- For example, match a single line to insert before/after it`,
			},
		}
	}

	const matchResult = findMatchInLines(
		currentLines,
		searchLines,
		searchContent,
		replaceContent,
		startLine,
		replacement.startLine,
		bufferLines,
		fuzzyThreshold,
	)

	if (!matchResult) {
		const searchChunk = searchLines.join("\n")
		return {
			resultLines: currentLines,
			delta: currentDelta,
			applied: false,
			diffResult: pushNoMatchError(
				currentLines,
				searchChunk,
				startLine,
				replacement.startLine,
				-1,
				0,
				"",
				bufferLines,
				fuzzyThreshold,
			),
		}
	}

	const { matchIndex, matchedLines, indentedReplaceLines } = matchResult

	const beforeMatch = currentLines.slice(0, matchIndex)
	const afterMatch = currentLines.slice(matchIndex + searchLines.length)
	const newLines = [...beforeMatch, ...indentedReplaceLines, ...afterMatch]
	const newDelta = currentDelta - matchedLines.length + indentedReplaceLines.length

	return {
		resultLines: newLines,
		delta: newDelta,
		applied: true,
	}
}
