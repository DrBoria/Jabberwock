/**
 * Parser for the apply_patch tool format.
 * Converts patch text into structured hunks following the Codex apply_patch specification.
 *
 * Grammar:
 * Patch := Begin { FileOp } End
 * Begin := "*** Begin Patch" NEWLINE
 * End := "*** End Patch" NEWLINE
 * FileOp := AddFile | DeleteFile | UpdateFile
 * AddFile := "*** Add File: " path NEWLINE { "+" line NEWLINE }
 * DeleteFile := "*** Delete File: " path NEWLINE
 * UpdateFile := "*** Update File: " path NEWLINE [ MoveTo ] { Hunk }
 * MoveTo := "*** Move to: " newPath NEWLINE
 * Hunk := "@@" [ header ] NEWLINE { HunkLine } [ "*** End of File" NEWLINE ]
 * HunkLine := (" " | "-" | "+") text NEWLINE
 */

import { checkPatchBoundaries, parseOneHunk } from "./parser.helpers"
import type { ApplyPatchArgs, Hunk } from "./parser.types"

/**
 * Parse a patch string into structured hunks.
 *
 * @param patch - The patch text to parse
 * @returns Parsed patch with hunks
 * @throws ParseError if the patch is invalid
 */
export function parsePatch(patch: string): ApplyPatchArgs {
	const trimmedPatch = patch.trim()
	const lines = trimmedPatch.split("\n")

	// Handle heredoc-wrapped patches (lenient mode)
	let effectiveLines = lines
	if (lines.length >= 4) {
		const firstLine = lines[0]
		const lastLine = lines[lines.length - 1]
		if (
			(firstLine === "<<EOF" || firstLine === "<<'EOF'" || firstLine === '<<"EOF"') &&
			lastLine?.endsWith("EOF")
		) {
			effectiveLines = lines.slice(1, lines.length - 1)
		}
	}

	checkPatchBoundaries(effectiveLines)

	const hunks: Hunk[] = []
	const lastLineIndex = effectiveLines.length - 1
	let remainingLines = effectiveLines.slice(1, lastLineIndex) // Skip Begin and End markers
	let lineNumber = 2 // Start at line 2 (after Begin Patch)

	while (remainingLines.length > 0) {
		const { hunk, linesConsumed } = parseOneHunk(remainingLines, lineNumber)
		hunks.push(hunk)
		lineNumber += linesConsumed
		remainingLines = remainingLines.slice(linesConsumed)
	}

	return {
		hunks,
		patch: effectiveLines.join("\n"),
	}
}
