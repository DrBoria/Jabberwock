import { sanitizeUnifiedDiff, computeDiffStats } from "@features/foundation/time-machine/actions/stats"
import { isPathOutsideWorkspace } from "@utils/io"
import { getReadablePath } from "@utils/io/path"
import type { SayToolData } from "@jabberwock/types"
import type { ITaskModel } from "@features/chat/task/store"
import type { ReplacementError } from "./editFileHelpers.types"

export function formatReplacementError(error: ReplacementError): string {
	switch (error.type) {
		case "no_match":
			return `No match found in file: ${error.absolutePath}\n\n<error_details>\nThe provided old_string could not be found using exact, whitespace-tolerant, or token-based matching.\n\nRecovery suggestions:\n1. Use read_file to confirm the file's current contents\n2. Ensure old_string matches exactly (including whitespace/indentation and line endings)\n3. Provide more surrounding context in old_string to make the match unique\n4. If the file has changed since you constructed old_string, re-read and retry\n</error_details>`
		case "exact_count_mismatch":
			return `Occurrence count mismatch in file: ${error.absolutePath}\n\n<error_details>\nExpected ${error.expectedReplacements} occurrence(s) but found ${error.exactOccurrences} exact match(es).\n\nRecovery suggestions:\n1. Provide a more specific old_string so it matches exactly once\n2. If you intend to replace all occurrences, set expected_replacements to ${error.exactOccurrences}\n3. Use read_file to confirm the exact text and counts\n</error_details>`
		case "fuzzy_count_mismatch":
			return `Occurrence count mismatch in file: ${error.absolutePath}\n\n<error_details>\nExpected ${error.expectedReplacements} occurrence(s), but matching found ${error.wsOccurrences} (whitespace-tolerant) and ${error.tokenOccurrences} (token-based).\n\nRecovery suggestions:\n1. Provide more surrounding context in old_string to make the match unique\n2. If multiple replacements are intended, adjust expected_replacements to the intended count\n3. Use read_file to confirm the current file contents and refine the match\n</error_details>`
	}
}

export function buildFileExistsError(absolutePath: string): string {
	return `File already exists: ${absolutePath}\n\n<error_details>\nYou provided an empty old_string, which indicates file creation, but the target file already exists.\n\nRecovery suggestions:\n1. To modify an existing file, provide a non-empty old_string that matches the current file contents\n2. Use read_file to confirm the exact text to match\n3. If you intended to overwrite the entire file, use write_to_file instead\n</error_details>`
}

export function buildReadFileError(absolutePath: string, errorDetails: string): string {
	return `Failed to read file: ${absolutePath}\n\n<error_details>\nRead error: ${errorDetails}\n\nRecovery suggestions:\n1. Verify the file exists and is readable\n2. Check file permissions\n3. If the file may have changed, use read_file to confirm its current contents\n</error_details>`
}

export function buildFileNotFoundError(absolutePath: string): string {
	return `File does not exist at path: ${absolutePath}\n\n<error_details>\nThe specified file could not be found, so the replacement could not be performed.\n\nRecovery suggestions:\n1. Verify the file path is correct\n2. If you intended to create a new file, set old_string to an empty string\n3. Use list_files or read_file to confirm the correct path\n</error_details>`
}

export function buildEditApprovalMessage(
	task: ITaskModel,
	relPath: string,
	absolutePath: string,
	currentContent: string | null,
	newContent: string,
	isNewFile: boolean,
	isFileWriteProtected: boolean,
	diff: string,
): string {
	const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)
	const sanitizedDiff = sanitizeUnifiedDiff(diff)
	const diffStats = computeDiffStats(sanitizedDiff) || undefined

	const sharedMessageProps: SayToolData = {
		tool: isNewFile ? "newFileCreated" : "appliedDiff",
		path: getReadablePath(task.cwd, relPath),
		diff: sanitizedDiff,
		isOutsideWorkspace,
	}

	return JSON.stringify({
		...sharedMessageProps,
		content: sanitizedDiff,
		isProtected: isFileWriteProtected,
		diffStats,
	} satisfies SayToolData)
}
