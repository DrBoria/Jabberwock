export {
	performEditReplacement,
	normalizeToLF,
	restoreLineEnding,
	resolveRelativePath,
	escapeRegExp,
	buildWhitespaceTolerantRegex,
	buildTokenRegex,
	countRegexMatches,
	countOccurrences,
	safeLiteralReplace,
	detectLineEnding,
	coerceStringParam,
	resetEditFileMistakeCount,
} from "./main.ts"
export {
	formatReplacementError,
	buildFileExistsError,
	buildReadFileError,
	buildFileNotFoundError,
	buildEditApprovalMessage,
} from "./errors.ts"
export type { LineEnding, ReplacementResult, ReplacementError } from "./types.ts"
