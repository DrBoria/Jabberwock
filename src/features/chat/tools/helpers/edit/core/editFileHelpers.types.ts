export type LineEnding = "\r\n" | "\n"

export interface ReplacementResult {
	contentLF: string
	matched: boolean
}

export interface ReplacementError {
	type: "no_match" | "exact_count_mismatch" | "fuzzy_count_mismatch"
	exactOccurrences: number
	wsOccurrences: number
	tokenOccurrences: number
	expectedReplacements: number
	absolutePath: string
}
