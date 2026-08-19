import * as vscode from "vscode"
import * as diff from "diff"
import stripBom from "strip-bom"
import delay from "delay"

import { formatResponse } from "@features/settings/context/responses"
import { diagnosticsToProblemsString, getNewDiagnostics } from "@integrations/diagnostics"

export const DIFF_VIEW_URI_SCHEME_JABBERWOCK = "jabberwock-diff"
export const DIFF_VIEW_LABEL_CHANGES = "Original ↔ Jabberwock's Changes"

export function stripAllBOMs(input: string): string {
	let result = input
	let previous

	do {
		previous = result
		result = stripBom(result)
	} while (result !== previous)

	return result
}

export function shouldScrollToLine(activeDiffEditor: vscode.TextEditor | undefined, endLine: number): boolean {
	const ranges = activeDiffEditor?.visibleRanges
	if (!ranges || ranges.length === 0) {
		return false
	}
	return ranges[0].start.line < endLine && ranges[0].end.line > endLine
}

export function detectUserEdits(
	relPath: string,
	editedContent: string,
	newContent: string,
): { userEdits: string | undefined; finalContent: string } {
	const newContentEOL = newContent.includes("\r\n") ? "\r\n" : "\n"

	const normalizedEditedContent = editedContent.replace(/\r\n|\n/g, newContentEOL)
	const normalizedNewContent = newContent.replace(/\r\n|\n/g, newContentEOL)

	if (normalizedEditedContent !== normalizedNewContent) {
		const userEdits = formatResponse.createPrettyPatch(
			relPath.toPosix(),
			normalizedNewContent,
			normalizedEditedContent,
		)
		return { userEdits, finalContent: normalizedEditedContent }
	}

	return { userEdits: undefined, finalContent: normalizedEditedContent }
}

export function scrollEditorToLine(activeDiffEditor: vscode.TextEditor | undefined, line: number): void {
	if (activeDiffEditor) {
		const scrollLine = line + 4

		activeDiffEditor.revealRange(
			new vscode.Range(scrollLine, 0, scrollLine, 0),
			vscode.TextEditorRevealType.InCenter,
		)
	}
}

export function scrollToFirstDiff(activeDiffEditor: vscode.TextEditor | undefined, originalContent: string): void {
	if (!activeDiffEditor) {
		return
	}

	const currentContent = activeDiffEditor.document.getText()
	const diffs = diff.diffLines(originalContent || "", currentContent)

	let lineCount = 0

	for (const part of diffs) {
		if (part.added || part.removed) {
			activeDiffEditor.revealRange(
				new vscode.Range(lineCount, 0, lineCount, 0),
				vscode.TextEditorRevealType.InCenter,
			)

			return
		}

		if (!part.removed) {
			lineCount += part.count || 0
		}
	}
}

export async function getNewDiagnosticsMessage(
	preDiagnostics: [vscode.Uri, vscode.Diagnostic[]][],
	cwd: string,
	writeDelayMs: number,
): Promise<string> {
	const safeDelayMs = Math.max(0, writeDelayMs)

	try {
		await delay(safeDelayMs)
	} catch (error) {
		console.warn(`[jabberwock] Failed to apply write delay: ${error}`)
	}

	const postDiagnostics = vscode.languages.getDiagnostics()

	const newProblems = await diagnosticsToProblemsString(
		getNewDiagnostics(preDiagnostics, postDiagnostics),
		[vscode.DiagnosticSeverity.Error],
		cwd,
		true,
		50,
	)

	return newProblems.length > 0 ? `\n\nNew problems detected after saving the file:\n${newProblems}` : ""
}
