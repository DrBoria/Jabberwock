import * as path from "path"
import * as fs from "fs/promises"
import deepEqual from "fast-deep-equal"
import type { IUri, IDiagnostic } from "@jabberwock/types"

/**
 * Host-neutral diagnostic severity constants (D4g-2 batch 3).
 *
 * Mirror the `vscode.DiagnosticSeverity` enum values (0 = Error, 1 = Warning, 2 = Information,
 * 3 = Hint) so the shared diagnostics formatter and its callers do not import "vscode". A
 * `vscode.Diagnostic` is structurally assignable to `IDiagnostic`, so callers that already hold
 * vscode diagnostics can pass them through unchanged.
 */
export const DiagnosticSeverity = {
	Error: 0,
	Warning: 1,
	Information: 2,
	Hint: 3,
} as const

export function getNewDiagnostics(
	oldDiagnostics: [IUri, IDiagnostic[]][],
	newDiagnostics: [IUri, IDiagnostic[]][],
): [IUri, IDiagnostic[]][] {
	const newProblems: [IUri, IDiagnostic[]][] = []
	const oldMap = new Map(oldDiagnostics)

	for (const [uri, newDiags] of newDiagnostics) {
		const oldDiags = oldMap.get(uri) || []
		const newProblemsForUri = newDiags.filter((newDiag) => !oldDiags.some((oldDiag) => deepEqual(oldDiag, newDiag)))

		if (newProblemsForUri.length > 0) {
			newProblems.push([uri, newProblemsForUri])
		}
	}

	return newProblems
}

interface DiagnosticEntry {
	uri: IUri
	diagnostic: IDiagnostic
	formattedText?: string
}

function flatDiagnostics(diagnostics: [IUri, IDiagnostic[]][], severities: number[]): DiagnosticEntry[] {
	const result: DiagnosticEntry[] = []
	for (const [uri, fileDiagnostics] of diagnostics) {
		const filtered = fileDiagnostics.filter((d) => severities.includes(d.severity))
		for (const diagnostic of filtered) {
			result.push({ uri, diagnostic })
		}
	}
	result.sort((a, b) => {
		const severityDiff = a.diagnostic.severity - b.diagnostic.severity
		if (severityDiff !== 0) return severityDiff
		return a.diagnostic.range.start.line - b.diagnostic.range.start.line
	})
	return result
}

async function takeUntilLimit(
	entries: DiagnosticEntry[],
	limit: number,
	documents: Map<string, string[]>,
	fileStats: Map<string, boolean>,
): Promise<DiagnosticEntry[]> {
	const result: DiagnosticEntry[] = []
	for (let i = 0; i < entries.length && i < limit; i++) {
		const entry = entries[i]
		entry.formattedText = await formatDiagnosticLine(entry.diagnostic, entry.uri, documents, fileStats)
		result.push(entry)
	}
	return result
}

function buildGroupedResult(entries: DiagnosticEntry[], cwd: string): string {
	const grouped = new Map<string, DiagnosticEntry[]>()
	for (const entry of entries) {
		const key = entry.uri.fsPath
		const existing = grouped.get(key)
		if (existing) {
			existing.push(entry)
		} else {
			grouped.set(key, [entry])
		}
	}

	let result = ""
	for (const [_uriStr, fileEntries] of grouped) {
		const uri = fileEntries[0].uri
		fileEntries.sort((a, b) => a.diagnostic.range.start.line - b.diagnostic.range.start.line)
		result += `\n\n${path.relative(cwd, uri.fsPath).toPosix()}`
		for (const entry of fileEntries) {
			result += entry.formattedText
		}
	}
	return result
}

function getDiagnosticLabel(severity: number): string {
	switch (severity) {
		case DiagnosticSeverity.Error:
			return "Error"
		case DiagnosticSeverity.Warning:
			return "Warning"
		case DiagnosticSeverity.Information:
			return "Information"
		case DiagnosticSeverity.Hint:
			return "Hint"
		default:
			return "Diagnostic"
	}
}

async function formatDiagnosticLine(
	diagnostic: IDiagnostic,
	uri: IUri,
	documents: Map<string, string[]>,
	fileStats: Map<string, boolean>,
): Promise<string> {
	const label = getDiagnosticLabel(diagnostic.severity)
	const line = diagnostic.range.start.line + 1
	const source = diagnostic.source ? `${diagnostic.source} ` : ""

	try {
		let isFile = fileStats.get(uri.fsPath)
		if (isFile === undefined) {
			// D4g-2 (batch 3): plain Node fs stat (the path is a local fs path) — replaces the
			// vscode.workspace.fs.stat call so this shared formatter stays host-neutral.
			const stat = await fs.stat(uri.fsPath)
			isFile = stat.isFile()
			fileStats.set(uri.fsPath, isFile)
		}
		if (isFile) {
			let lines = documents.get(uri.fsPath)
			if (!lines) {
				// D4g-2 (batch 3): plain Node fs read (replaces vscode.workspace.openTextDocument).
				// Splitting on any line ending yields the same per-line text as
				// vscode's document.lineAt(line).text (which excludes the line ending).
				const content = await fs.readFile(uri.fsPath, "utf-8")
				lines = content.split(/\r\n|\n|\r/)
				documents.set(uri.fsPath, lines)
			}
			const lineContent = lines[diagnostic.range.start.line] ?? ""
			return `\n- [${source}${label}] ${line} | ${lineContent} : ${diagnostic.message}`
		}
		return `\n- [${source}${label}] 1 | (directory) : ${diagnostic.message}`
	} catch {
		return `\n- [${source}${label}] ${line} | (unavailable) : ${diagnostic.message}`
	}
}

async function processDiagnosticsWithLimit(
	diagnostics: [IUri, IDiagnostic[]][],
	severities: number[],
	cwd: string,
	maxDiagnosticMessages: number,
	documents: Map<string, string[]>,
	fileStats: Map<string, boolean>,
): Promise<string> {
	const allDiagnostics = flatDiagnostics(diagnostics, severities)
	const includedDiagnostics = await takeUntilLimit(allDiagnostics, maxDiagnosticMessages, documents, fileStats)
	const result = buildGroupedResult(includedDiagnostics, cwd)

	if (allDiagnostics.length > includedDiagnostics.length) {
		return `${result}\n\n... ${allDiagnostics.length - includedDiagnostics.length} more problems omitted to prevent context overflow`
	}

	return result
}

async function processDiagnosticsWithoutLimit(
	diagnostics: [IUri, IDiagnostic[]][],
	severities: number[],
	cwd: string,
	documents: Map<string, string[]>,
	fileStats: Map<string, boolean>,
): Promise<string> {
	let result = ""

	for (const [uri, fileDiagnostics] of diagnostics) {
		const problems = fileDiagnostics
			.filter((d) => severities.includes(d.severity))
			.sort((a, b) => a.range.start.line - b.range.start.line)

		if (problems.length === 0) {
			continue
		}

		result += `\n\n${path.relative(cwd, uri.fsPath).toPosix()}`
		for (const diagnostic of problems) {
			result += await formatDiagnosticLine(diagnostic, uri, documents, fileStats)
		}
	}

	return result
}

// will return empty string if no problems with the given severity are found
export async function diagnosticsToProblemsString(
	diagnostics: [IUri, IDiagnostic[]][],
	severities: number[],
	cwd: string,
	includeDiagnosticMessages: boolean = true,
	maxDiagnosticMessages?: number,
): Promise<string> {
	if (!includeDiagnosticMessages) {
		return ""
	}

	const documents = new Map<string, string[]>()
	const fileStats = new Map<string, boolean>()

	const hasLimit = maxDiagnosticMessages && maxDiagnosticMessages > 0

	const result = hasLimit
		? await processDiagnosticsWithLimit(diagnostics, severities, cwd, maxDiagnosticMessages!, documents, fileStats)
		: await processDiagnosticsWithoutLimit(diagnostics, severities, cwd, documents, fileStats)

	return result.trim()
}
