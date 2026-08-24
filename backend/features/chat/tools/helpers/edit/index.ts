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
	formatReplacementError,
	buildFileExistsError,
	buildReadFileError,
	buildFileNotFoundError,
	buildEditApprovalMessage,
} from "./core"
export type { LineEnding, ReplacementResult, ReplacementError } from "./core"

export {
	handleEditFileApprovalAndSave,
	handleEditFilePartial,
	handleEditFileNoChanges,
	handleEditFileReplacementError,
	recordEditFileFailure,
	readEditFileState,
} from "./editFileSaveHelpers/index"

export { validateEditParams, readAndValidateEditFile, requestEditApprovalAndSave } from "./editToolHelpers"

export { validateSearchReplaceParams, validateSearchReplaceAccess, readAndMatchContent } from "./search-replace"
export { applySearchReplaceDiff } from "./search-replace"

export {
	buildApplyDiffResult,
	buildApprovalMessage,
	buildDiffFailureError,
	buildProgressStatus,
	buildSharedMessageProps,
	escapeDiffContentIfNeeded,
	handleApplyDiffPartial,
	saveDiffDirectly,
	saveDiffWithView,
	handlePatchAddFile,
	handlePatchDeleteFile,
	handlePatchUpdateFile,
} from "./apply"
