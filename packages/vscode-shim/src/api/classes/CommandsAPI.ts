/**
 * CommandsAPI class for VSCode API
 */

import { logs } from "../../utils/logger.ts"
import { Uri } from "../../classes/types/Uri.ts"
import { Position } from "../../classes/types/Position.ts"
import { Range } from "../../classes/types/Range.ts"
import { Selection } from "../../classes/types/Selection.ts"
import { ViewColumn, EndOfLine } from "../../types.ts"
import type { Thenable } from "../../types.ts"
import type { TextEditor, TextEditorEdit } from "../../interfaces/editor.ts"
import type { TextDocument } from "../../interfaces/document.ts"
import type { Disposable } from "../../interfaces/workspace.ts"
import type { WorkspaceAPI } from "./WorkspaceAPI.ts"
import type { WindowAPI } from "./WindowAPI.ts"

/**
 * Commands API mock for CLI mode
 */
/**
 * Global augmentation for VSCode shim APIs accessible via globalThis.
 */
interface GlobalWithVscode {
	vscode?: {
		workspace?: WorkspaceAPI
		window?: WindowAPI
	}
}

export class CommandsAPI {
	private commands: Map<string, (...args: unknown[]) => unknown> = new Map()

	registerCommand(command: string, callback: (...args: unknown[]) => unknown): Disposable {
		this.commands.set(command, callback)
		return {
			dispose: () => {
				this.commands.delete(command)
			},
		}
	}

	executeCommand<T = unknown>(command: string, ...rest: unknown[]): Thenable<T> {
		const handler = this.commands.get(command)
		if (handler) {
			try {
				const result = handler(...rest)
				return Promise.resolve(result as T)
			} catch (error) {
				return Promise.reject(error)
			}
		}

		// Handle built-in commands
		switch (command) {
			case "workbench.action.files.saveFiles":
			case "workbench.action.closeWindow":
			case "workbench.action.reloadWindow":
				return Promise.resolve(undefined as T)
			case "vscode.diff":
				// Simulate opening a diff view for the CLI
				// The extension's DiffViewProvider expects this to create a diff editor
				return this.handleDiffCommand(
					rest[0] as Uri,
					rest[1] as Uri,
					rest[2] as string | undefined,
					rest[3],
				) as Thenable<T>
			default:
				logs.warn(`Unknown command: ${command}`, "VSCode.Commands")
				return Promise.resolve(undefined as T)
		}
	}

	private async executeDiffCore(workspace: WorkspaceAPI, window: WindowAPI, modifiedUri: Uri): Promise<void> {
		logs.info(
			`[DIFF] Current visibleTextEditors count: ${window.visibleTextEditors?.length || 0}`,
			"VSCode.Commands",
		)
		try {
			const document = await findOrOpenDocument(workspace, modifiedUri)
			const mockEditor = createMockEditor(document)
			ensureDiffEditorVisible(window, mockEditor, modifiedUri)
			logs.info(`[DIFF] visibleTextEditors count: ${window.visibleTextEditors.length}`, "VSCode.Commands")
			logs.info(
				`[DIFF] Diff view simulation complete (events already fired by showTextDocument)`,
				"VSCode.Commands",
			)
		} catch (error) {
			logs.error("[DIFF] Error simulating diff view", "VSCode.Commands", { error })
		}
	}

	private async handleDiffCommand(
		originalUri: Uri,
		modifiedUri: Uri,
		title?: string,
		_options?: unknown,
	): Promise<void> {
		logs.info(`[DIFF] Handling vscode.diff command`, "VSCode.Commands", {
			originalUri: originalUri?.toString(),
			modifiedUri: modifiedUri?.toString(),
			title,
		})

		if (!modifiedUri) {
			logs.warn("[DIFF] vscode.diff called without modified URI", "VSCode.Commands")
			return
		}

		const workspace = (globalThis as GlobalWithVscode).vscode?.workspace
		const window = (globalThis as GlobalWithVscode).vscode?.window

		if (!workspace || !window) {
			logs.warn("[DIFF] VSCode APIs not available for diff command", "VSCode.Commands")
			return
		}

		await this.executeDiffCore(workspace, window, modifiedUri)
	}
}

async function findOrOpenDocument(workspace: WorkspaceAPI, modifiedUri: Uri): Promise<TextDocument> {
	logs.info(`[DIFF] Looking for already-opened document: ${modifiedUri.fsPath}`, "VSCode.Commands")
	const existing = workspace.textDocuments.find((doc: TextDocument) => doc.uri.fsPath === modifiedUri.fsPath)
	if (existing) {
		logs.info(`[DIFF] Found existing document, lineCount: ${existing.lineCount}`, "VSCode.Commands")
		return existing
	}
	logs.info(`[DIFF] Document not found, opening: ${modifiedUri.fsPath}`, "VSCode.Commands")
	const document = await workspace.openTextDocument(modifiedUri)
	logs.info(`[DIFF] Document opened successfully, lineCount: ${document.lineCount}`, "VSCode.Commands")
	return document
}

function createMockEditor(document: TextDocument): TextEditor {
	return {
		document,
		selection: new Selection(new Position(0, 0), new Position(0, 0)),
		selections: [new Selection(new Position(0, 0), new Position(0, 0))],
		visibleRanges: [new Range(new Position(0, 0), new Position(0, 0))],
		options: {},
		viewColumn: ViewColumn.One,
		edit: async (callback: (editBuilder: TextEditorEdit) => void) => {
			const editBuilder: TextEditorEdit = {
				replace: (_range: Range | Position | Selection, _text: string) => {
					logs.debug("Mock edit builder replace called", "VSCode.Commands")
				},
				insert: (_position: Position, _text: string) => {
					logs.debug("Mock edit builder insert called", "VSCode.Commands")
				},
				delete: (_range: Range | Selection) => {
					logs.debug("Mock edit builder delete called", "VSCode.Commands")
				},
				setEndOfLine: (_endOfLine: EndOfLine) => {
					logs.debug("Mock edit builder setEndOfLine called", "VSCode.Commands")
				},
			}
			callback(editBuilder)
			return true
		},
		insertSnippet: () => Promise.resolve(true),
		setDecorations: () => {},
		revealRange: () => {},
		show: () => {},
		hide: () => {},
	}
}

function ensureDiffEditorVisible(window: WindowAPI, mockEditor: TextEditor, modifiedUri: Uri): void {
	if (!window.visibleTextEditors) {
		window.visibleTextEditors = []
	}

	const existingEditor = window.visibleTextEditors.find(
		(e: TextEditor) => e.document.uri.fsPath === modifiedUri.fsPath,
	)

	if (existingEditor) {
		logs.info(`[DIFF] Editor already in visibleTextEditors, updating it`, "VSCode.Commands")
		Object.assign(existingEditor, mockEditor)
	} else {
		logs.info(`[DIFF] Adding new mock editor to visibleTextEditors`, "VSCode.Commands")
		window.visibleTextEditors.push(mockEditor)
	}
}
