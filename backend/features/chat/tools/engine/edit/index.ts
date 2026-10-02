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
} from "./core/index.ts"
export type { LineEnding, ReplacementResult, ReplacementError } from "./core/index.ts"

export {
	handleEditFileApprovalAndSave,
	handleEditFilePartial,
	handleEditFileNoChanges,
	handleEditFileReplacementError,
	recordEditFileFailure,
	readEditFileState,
} from "./editFileSaveHelpers/index.ts"

export { validateEditParams, readAndValidateEditFile, requestEditApprovalAndSave } from "./editToolHelpers.ts"

export {
	validateSearchReplaceParams,
	validateSearchReplaceAccess,
	readAndMatchContent,
} from "./search-replace/index.ts"
export { applySearchReplaceDiff } from "./search-replace/index.ts"

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
} from "./apply/index.ts"
