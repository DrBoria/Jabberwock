import * as vscode from "vscode"
import * as path from "path"
import deepEqual from "fast-deep-equal"

export function getNewDiagnostics(
	oldDiagnostics: [vscode.Uri, vscode.Diagnostic[]][],
	newDiagnostics: [vscode.Uri, vscode.Diagnostic[]][],
): [vscode.Uri, vscode.Diagnostic[]][] {
	const newProblems: [vscode.Uri, vscode.Diagnostic[]][] = []
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
	uri: vscode.Uri
	diagnostic: vscode.Diagnostic
	formattedText?: string
}

function flatDiagnostics(
	diagnostics: [vscode.Uri, vscode.Diagnostic[]][],
	severities: vscode.DiagnosticSeverity[],
): DiagnosticEntry[] {
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
	documents: Map<vscode.Uri, vscode.TextDocument>,
	fileStats: Map<vscode.Uri, vscode.FileStat>,
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
		const key = entry.uri.toString()
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

function getDiagnosticLabel(severity: vscode.DiagnosticSeverity): string {
	switch (severity) {
		case vscode.DiagnosticSeverity.Error:
			return "Error"
		case vscode.DiagnosticSeverity.Warning:
			return "Warning"
		case vscode.DiagnosticSeverity.Information:
			return "Information"
		case vscode.DiagnosticSeverity.Hint:
			return "Hint"
		default:
			return "Diagnostic"
	}
}

async function formatDiagnosticLine(
	diagnostic: vscode.Diagnostic,
	uri: vscode.Uri,
	documents: Map<vscode.Uri, vscode.TextDocument>,
	fileStats: Map<vscode.Uri, vscode.FileStat>,
): Promise<string> {
	const label = getDiagnosticLabel(diagnostic.severity)
	const line = diagnostic.range.start.line + 1
	const source = diagnostic.source ? `${diagnostic.source} ` : ""

	try {
		let fileStat = fileStats.get(uri)
		if (!fileStat) {
			fileStat = await vscode.workspace.fs.stat(uri)
			fileStats.set(uri, fileStat)
		}
		if (fileStat.type === vscode.FileType.File) {
			const document = documents.get(uri) || (await vscode.workspace.openTextDocument(uri))
			documents.set(uri, document)
			const lineContent = document.lineAt(diagnostic.range.start.line).text
			return `\n- [${source}${label}] ${line} | ${lineContent} : ${diagnostic.message}`
		}
		return `\n- [${source}${label}] 1 | (directory) : ${diagnostic.message}`
	} catch {
		return `\n- [${source}${label}] ${line} | (unavailable) : ${diagnostic.message}`
	}
}

async function processDiagnosticsWithLimit(
	diagnostics: [vscode.Uri, vscode.Diagnostic[]][],
	severities: vscode.DiagnosticSeverity[],
	cwd: string,
	maxDiagnosticMessages: number,
	documents: Map<vscode.Uri, vscode.TextDocument>,
	fileStats: Map<vscode.Uri, vscode.FileStat>,
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
	diagnostics: [vscode.Uri, vscode.Diagnostic[]][],
	severities: vscode.DiagnosticSeverity[],
	cwd: string,
	documents: Map<vscode.Uri, vscode.TextDocument>,
	fileStats: Map<vscode.Uri, vscode.FileStat>,
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
	diagnostics: [vscode.Uri, vscode.Diagnostic[]][],
	severities: vscode.DiagnosticSeverity[],
	cwd: string,
	includeDiagnosticMessages: boolean = true,
	maxDiagnosticMessages?: number,
): Promise<string> {
	if (!includeDiagnosticMessages) {
		return ""
	}

	const documents = new Map<vscode.Uri, vscode.TextDocument>()
	const fileStats = new Map<vscode.Uri, vscode.FileStat>()

	const hasLimit = maxDiagnosticMessages && maxDiagnosticMessages > 0

	const result = hasLimit
		? await processDiagnosticsWithLimit(diagnostics, severities, cwd, maxDiagnosticMessages!, documents, fileStats)
		: await processDiagnosticsWithoutLimit(diagnostics, severities, cwd, documents, fileStats)

	return result.trim()
}
