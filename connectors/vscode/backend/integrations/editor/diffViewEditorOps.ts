import * as vscode from "vscode"
import * as path from "path"
import { arePathsEqual } from "@utils/io/path"
import { type DecorationController } from "./DecorationController"
import {
	DIFF_VIEW_URI_SCHEME_JABBERWOCK,
	DIFF_VIEW_LABEL_CHANGES,
	stripAllBOMs,
	shouldScrollToLine,
	scrollEditorToLine,
} from "./diffViewHelpers"

export async function closeAllDiffViews(): Promise<void> {
	const closeOps = vscode.window.tabGroups.all
		.flatMap((group) => group.tabs)
		.filter((tab) => {
			if (
				tab.input instanceof vscode.TabInputTextDiff &&
				tab.input.original.scheme === DIFF_VIEW_URI_SCHEME_JABBERWOCK &&
				!tab.isDirty
			) {
				return true
			}

			if (tab.label.includes(DIFF_VIEW_LABEL_CHANGES) && !tab.isDirty) {
				return true
			}

			return false
		})
		.map((tab) =>
			vscode.window.tabGroups.close(tab).then(
				() => undefined,
				(err) => {
					console.error(`[jabberwock] Failed to close diff tab ${tab.label}`, err)
				},
			),
		)

	await Promise.all(closeOps)
}

export async function openDiffEditor(
	relPath: string,
	cwd: string,
	editType: "create" | "modify" | undefined,
	originalContent: string | undefined,
): Promise<vscode.TextEditor> {
	const uri = vscode.Uri.file(path.resolve(cwd, relPath))

	const diffTab = vscode.window.tabGroups.all
		.flatMap((group) => group.tabs)
		.find(
			(tab) =>
				tab.input instanceof vscode.TabInputTextDiff &&
				tab.input?.original?.scheme === DIFF_VIEW_URI_SCHEME_JABBERWOCK &&
				arePathsEqual(tab.input.modified.fsPath, uri.fsPath),
		)

	if (diffTab && diffTab.input instanceof vscode.TabInputTextDiff) {
		const editor = await vscode.window.showTextDocument(diffTab.input.modified, { preserveFocus: true })
		return editor
	}

	return new Promise<vscode.TextEditor>((resolve, reject) => {
		const fileName = path.basename(uri.fsPath)
		const fileExists = editType === "modify"
		const DIFF_EDITOR_TIMEOUT = 10_000

		let timeoutId: NodeJS.Timeout | undefined
		const disposables: vscode.Disposable[] = []

		const cleanup = () => {
			if (timeoutId) {
				clearTimeout(timeoutId)
				timeoutId = undefined
			}
			disposables.forEach((d) => d.dispose())
			disposables.length = 0
		}

		timeoutId = setTimeout(() => {
			cleanup()
			reject(
				new Error(
					`Failed to open diff editor for ${uri.fsPath} within ${DIFF_EDITOR_TIMEOUT / 1000} seconds. The editor may be blocked or VS Code may be unresponsive.`,
				),
			)
		}, DIFF_EDITOR_TIMEOUT)

		disposables.push(
			vscode.workspace.onDidOpenTextDocument(async (document) => {
				if (document.uri.scheme === "file" && arePathsEqual(document.uri.fsPath, uri.fsPath)) {
					await new Promise((r) => setTimeout(r, 0))

					const editor = vscode.window.visibleTextEditors.find(
						(e) => e.document.uri.scheme === "file" && arePathsEqual(e.document.uri.fsPath, uri.fsPath),
					)

					if (editor) {
						cleanup()
						resolve(editor)
					}
				}
			}),
		)

		disposables.push(
			vscode.window.onDidChangeVisibleTextEditors((editors) => {
				const editor = editors.find((e) => {
					const isFileScheme = e.document.uri.scheme === "file"
					const pathMatches = arePathsEqual(e.document.uri.fsPath, uri.fsPath)
					return isFileScheme && pathMatches
				})
				if (editor) {
					cleanup()
					resolve(editor)
				}
			}),
		)

		vscode.window
			.showTextDocument(uri, { preview: false, viewColumn: vscode.ViewColumn.Active, preserveFocus: true })
			.then(() => {
				return vscode.commands.executeCommand(
					"vscode.diff",
					vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME_JABBERWOCK}:${fileName}`).with({
						query: Buffer.from(originalContent ?? "").toString("base64"),
					}),
					uri,
					`${fileName}: ${fileExists ? `${DIFF_VIEW_LABEL_CHANGES}` : "New File"} (Editable)`,
					{ preserveFocus: true },
				)
			})
			.then(
				() => {},
				(err: unknown) => {
					cleanup()
					reject(
						new Error(
							`Failed to execute diff command for ${uri.fsPath}: ${err instanceof Error ? err.message : String(err)}`,
						),
					)
				},
			)
	})
}

export async function applyStreamingEdit(
	document: vscode.TextDocument,
	accumulatedLines: string[],
	activeDiffEditor: vscode.TextEditor,
	fadedOverlayController: DecorationController,
	activeLineController: DecorationController,
): Promise<void> {
	const endLine = accumulatedLines.length
	const rangeToReplace = new vscode.Range(0, 0, endLine, 0)
	const contentToReplace = accumulatedLines.slice(0, endLine).join("\n") + (accumulatedLines.length > 0 ? "\n" : "")

	const edit = new vscode.WorkspaceEdit()
	edit.replace(document.uri, rangeToReplace, stripAllBOMs(contentToReplace))
	await vscode.workspace.applyEdit(edit)

	activeLineController.setActiveLine(endLine)
	fadedOverlayController.updateOverlayAfterLine(endLine, document.lineCount)

	if (shouldScrollToLine(activeDiffEditor, endLine)) {
		scrollEditorToLine(activeDiffEditor, endLine)
	}
}

export async function applyFinalEdits(
	document: vscode.TextDocument,
	accumulatedContent: string,
	streamedLines: string[],
	originalContent: string | undefined,
	fadedOverlayController: DecorationController,
	activeLineController: DecorationController,
): Promise<void> {
	if (streamedLines.length < document.lineCount) {
		const edit = new vscode.WorkspaceEdit()
		edit.delete(document.uri, new vscode.Range(streamedLines.length, 0, document.lineCount, 0))
		await vscode.workspace.applyEdit(edit)
	}

	let finalContent = accumulatedContent
	const hasEmptyLastLine = originalContent?.endsWith("\n")

	if (hasEmptyLastLine && !finalContent.endsWith("\n")) {
		finalContent += "\n"
	}

	const finalEdit = new vscode.WorkspaceEdit()
	finalEdit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), stripAllBOMs(finalContent))
	await vscode.workspace.applyEdit(finalEdit)

	fadedOverlayController.clear()
	activeLineController.clear()
}
