import { reportLineMarkerInReplaceError } from "@features/foundation/time-machine/actions/strategies/multi-search-replace-errors"

import { transitionState } from "./multi-search-replace-transitions"

function checkLineMarkerInReplace(
	current: number,
	marker: string,
	rawLine: string,
	line: number,
): { success: boolean; error?: string } | undefined {
	if (current !== 2) return undefined
	if (marker.startsWith(":start_line:") && !rawLine.trim().startsWith("\\:start_line:")) {
		return reportLineMarkerInReplaceError(":start_line:", line)
	}
	if (marker.startsWith(":end_line:") && !rawLine.trim().startsWith("\\:end_line:")) {
		return reportLineMarkerInReplaceError(":end_line:", line)
	}
	return undefined
}

function validateMarkerTransitions(
	diffContent: string,
	SEARCH_PATTERN: RegExp,
	SEARCH: string,
	SEP: string,
	REPLACE: string,
	SEARCH_PREFIX: string,
	REPLACE_PREFIX: string,
	likelyBadStructure: boolean,
): { success: boolean; error?: string } | undefined {
	let current = 0
	let line = 0

	for (const rawLine of diffContent.split("\n")) {
		line++
		const marker = rawLine.trim()

		const lineMarkerError = checkLineMarkerInReplace(current, marker, rawLine, line)
		if (lineMarkerError) return lineMarkerError

		const transitionError = transitionState(
			current,
			marker,
			line,
			SEARCH_PATTERN,
			SEARCH,
			SEP,
			REPLACE,
			SEARCH_PREFIX,
			REPLACE_PREFIX,
			likelyBadStructure,
		)
		if (transitionError?.error) return transitionError as { success: boolean; error?: string }
		if (transitionError?.nextState !== undefined) current = transitionError.nextState
	}

	if (current !== 0) {
		return {
			success: false,
			error: `ERROR: Unexpected end of sequence: Expected '${
				current === 1 ? "=======" : ">>>>>>> REPLACE"
			}' was not found.`,
		}
	}

	return undefined
}

export function validateMarkerSequencing(diffContent: string): { success: boolean; error?: string } {
	const SEARCH_PATTERN = /^<<<<<<< SEARCH>?$/
	const SEARCH = SEARCH_PATTERN.source.replace(/[\^$]/g, "")
	const SEP = "======="
	const REPLACE = ">>>>>>> REPLACE"
	const SEARCH_PREFIX = "<<<<<<<"
	const REPLACE_PREFIX = ">>>>>>>"

	const lines = diffContent.split("\n")
	const searchCount = lines.filter((l) => SEARCH_PATTERN.test(l.trim())).length
	const sepCount = lines.filter((l) => l.trim() === SEP).length
	const replaceCount = lines.filter((l) => l.trim() === REPLACE).length
	const likelyBadStructure = searchCount !== replaceCount || sepCount < searchCount

	const result = validateMarkerTransitions(
		diffContent,
		SEARCH_PATTERN,
		SEARCH,
		SEP,
		REPLACE,
		SEARCH_PREFIX,
		REPLACE_PREFIX,
		likelyBadStructure,
	)

	return result ?? { success: true }
}
