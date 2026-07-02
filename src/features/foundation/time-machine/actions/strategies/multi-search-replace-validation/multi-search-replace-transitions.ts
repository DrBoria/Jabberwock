import {
	reportInvalidDiffError,
	reportMergeConflictError,
} from "@features/foundation/time-machine/actions/strategies/multi-search-replace-errors"

export function transitionFromStart(
	marker: string,
	SEARCH_PATTERN: RegExp,
	_SEARCH: string,
	SEP: string,
	REPLACE: string,
	SEARCH_PREFIX: string,
	REPLACE_PREFIX: string,
	likelyBadStructure: boolean,
	line: number,
): { nextState?: number; error?: { success: boolean; error?: string } } | undefined {
	if (marker === SEP) {
		return {
			error: likelyBadStructure
				? reportInvalidDiffError(SEP, marker, line)
				: reportMergeConflictError(SEP, marker, line),
		}
	}
	if (marker === REPLACE) return { error: reportInvalidDiffError(REPLACE, marker, line) }
	if (marker.startsWith(REPLACE_PREFIX)) return { error: reportMergeConflictError(marker, marker, line) }
	if (SEARCH_PATTERN.test(marker)) return { nextState: 1 }
	if (marker.startsWith(SEARCH_PREFIX)) return { error: reportMergeConflictError(marker, marker, line) }
	return
}

export function transitionAfterSearch(
	marker: string,
	SEARCH_PATTERN: RegExp,
	SEP: string,
	REPLACE: string,
	SEARCH_PREFIX: string,
	REPLACE_PREFIX: string,
	line: number,
): { nextState?: number; error?: { success: boolean; error?: string } } | undefined {
	if (SEARCH_PATTERN.test(marker)) return { error: reportInvalidDiffError(SEARCH_PATTERN.source, SEP, line) }
	if (marker.startsWith(SEARCH_PREFIX)) return { error: reportMergeConflictError(marker, marker, line) }
	if (marker === REPLACE) return { error: reportInvalidDiffError(REPLACE, SEP, line) }
	if (marker.startsWith(REPLACE_PREFIX)) return { error: reportMergeConflictError(marker, marker, line) }
	if (marker === SEP) return { nextState: 2 }
	return
}

export function transitionAfterSeparator(
	marker: string,
	SEARCH_PATTERN: RegExp,
	SEP: string,
	REPLACE: string,
	SEARCH_PREFIX: string,
	REPLACE_PREFIX: string,
	likelyBadStructure: boolean,
	line: number,
): { nextState?: number; error?: { success: boolean; error?: string } } | undefined {
	if (SEARCH_PATTERN.test(marker)) return { error: reportInvalidDiffError(SEARCH_PATTERN.source, REPLACE, line) }
	if (marker.startsWith(SEARCH_PREFIX)) return { error: reportMergeConflictError(marker, marker, line) }
	if (marker === SEP) {
		return {
			error: likelyBadStructure
				? reportInvalidDiffError(SEP, REPLACE, line)
				: reportMergeConflictError(SEP, REPLACE, line),
		}
	}
	if (marker === REPLACE) return { nextState: 0 }
	if (marker.startsWith(REPLACE_PREFIX)) return { error: reportMergeConflictError(marker, marker, line) }
	return
}

export function transitionState(
	current: number,
	marker: string,
	line: number,
	SEARCH_PATTERN: RegExp,
	SEARCH: string,
	SEP: string,
	REPLACE: string,
	SEARCH_PREFIX: string,
	REPLACE_PREFIX: string,
	likelyBadStructure: boolean,
): { nextState?: number; error?: { success: boolean; error?: string } } | undefined {
	if (current === 0) {
		return transitionFromStart(
			marker,
			SEARCH_PATTERN,
			SEARCH,
			SEP,
			REPLACE,
			SEARCH_PREFIX,
			REPLACE_PREFIX,
			likelyBadStructure,
			line,
		)
	}

	if (current === 1) {
		return transitionAfterSearch(marker, SEARCH_PATTERN, SEP, REPLACE, SEARCH_PREFIX, REPLACE_PREFIX, line)
	}

	return transitionAfterSeparator(
		marker,
		SEARCH_PATTERN,
		SEP,
		REPLACE,
		SEARCH_PREFIX,
		REPLACE_PREFIX,
		likelyBadStructure,
		line,
	)
}
