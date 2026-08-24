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
} from "./editFileHelpers"
export {
	formatReplacementError,
	buildFileExistsError,
	buildReadFileError,
	buildFileNotFoundError,
	buildEditApprovalMessage,
} from "./editFileHelpers.errors"
export type { LineEnding, ReplacementResult, ReplacementError } from "./editFileHelpers.types"
