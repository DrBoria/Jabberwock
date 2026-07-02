export const SEARCH_DISPLAY = "<<<<<<< SEARCH"
export const SEP_DISPLAY = "======="
export const REPLACE_DISPLAY = ">>>>>>> REPLACE"

export function reportMergeConflictError(
	found: string,
	_expected: string,
	line: number,
): { success: false; error: string } {
	return {
		success: false,
		error:
			`ERROR: Special marker '${found}' found in your diff content at line ${line}:\n` +
			"\n" +
			`When removing merge conflict markers like '${found}' from files, you MUST escape them\n` +
			"in your SEARCH section by prepending a backslash (\\) at the beginning of the line:\n" +
			"\n" +
			"CORRECT FORMAT:\n\n" +
			"<<<<<<< SEARCH\n" +
			"content before\n" +
			`\\${found}    <-- Note the backslash here in this example\n` +
			"content after\n" +
			"=======\n" +
			"replacement content\n" +
			">>>>>>> REPLACE\n" +
			"\n" +
			"Without escaping, the system confuses your content with diff syntax markers.\n" +
			"You may use multiple diff blocks in a single diff request, but ANY of ONLY the following separators that occur within SEARCH or REPLACE content must be escaped, as follows:\n" +
			`\\${SEARCH_DISPLAY}\n` +
			`\\${SEP_DISPLAY}\n` +
			`\\${REPLACE_DISPLAY}\n`,
	}
}

export function reportInvalidDiffError(
	found: string,
	expected: string,
	line: number,
): { success: false; error: string } {
	return {
		success: false,
		error:
			`ERROR: Diff block is malformed: marker '${found}' found in your diff content at line ${line}. Expected: ${expected}\n` +
			"\n" +
			"CORRECT FORMAT:\n\n" +
			"<<<<<<< SEARCH\n" +
			":start_line: (required) The line number of original content where the search block starts.\n" +
			"-------\n" +
			"[exact content to find including whitespace]\n" +
			"=======\n" +
			"[new content to replace with]\n" +
			">>>>>>> REPLACE\n",
	}
}

export function reportLineMarkerInReplaceError(marker: string, line: number): { success: false; error: string } {
	return {
		success: false,
		error:
			`ERROR: Invalid line marker '${marker}' found in REPLACE section at line ${line}\n` +
			"\n" +
			"Line markers (:start_line: and :end_line:) are only allowed in SEARCH sections.\n" +
			"\n" +
			"CORRECT FORMAT:\n" +
			"<<<<<<< SEARCH\n" +
			":start_line:5\n" +
			"content to find\n" +
			"=======\n" +
			"replacement content\n" +
			">>>>>>> REPLACE\n" +
			"\n" +
			"INCORRECT FORMAT:\n" +
			"<<<<<<< SEARCH\n" +
			"content to find\n" +
			"=======\n" +
			":start_line:5    <-- Invalid location\n" +
			"replacement content\n" +
			">>>>>>> REPLACE\n",
	}
}
