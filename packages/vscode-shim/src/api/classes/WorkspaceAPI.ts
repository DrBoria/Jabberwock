import * as fs from "fs"
import { applyEditsToFile, updateDocumentAfterEdit } from "../helpers/workspace-api-helpers.ts"
import * as path from "path"
import { logs } from "../../utils/logger.ts"
import { Uri } from "../../classes/types/Uri.ts"
import { Position } from "../../classes/types/Position.ts"
import { Range } from "../../classes/types/Range.ts"
import { EventEmitter } from "../../classes/events/EventEmitter.ts"
import { WorkspaceEdit } from "../../classes/text/TextEdit.ts"
import { FileSystemAPI } from "./FileSystemAPI.ts"
import { MockWorkspaceConfiguration } from "./WorkspaceConfiguration.ts"
import type { ExtensionContextImpl } from "../../context/ExtensionContext.ts"
import type {
	TextDocument,
	TextLine,
	WorkspaceFoldersChangeEvent,
	WorkspaceFolder,
	TextDocumentChangeEvent,
	ConfigurationChangeEvent,
	FileSystemWatcher,
} from "../../interfaces/document.ts"
import type { Disposable, WorkspaceConfiguration } from "../../interfaces/workspace.ts"
import type { Thenable } from "../../types.ts"

export class WorkspaceAPI {
	public workspaceFolders: WorkspaceFolder[] | undefined
	public name: string | undefined
	public workspaceFile: Uri | undefined
	public fs: FileSystemAPI
	public textDocuments: TextDocument[] = []
	private _onDidChangeWorkspaceFolders = new EventEmitter<WorkspaceFoldersChangeEvent>()
	private _onDidOpenTextDocument = new EventEmitter<TextDocument>()
	private _onDidChangeTextDocument = new EventEmitter<TextDocumentChangeEvent>()
	private _onDidCloseTextDocument = new EventEmitter<TextDocument>()
	private context: ExtensionContextImpl

	constructor(workspacePath: string, context: ExtensionContextImpl) {
		this.context = context
		this.workspaceFolders = [
			{
				uri: Uri.file(workspacePath),
				name: path.basename(workspacePath),
				index: 0,
			},
		]
		this.name = path.basename(workspacePath)
		this.fs = new FileSystemAPI()
	}

	asRelativePath(pathOrUri: string | Uri, includeWorkspaceFolder?: boolean): string {
		const fsPath = typeof pathOrUri === "string" ? pathOrUri : pathOrUri.fsPath

		// If no workspace folders, return the original path
		if (!this.workspaceFolders || this.workspaceFolders.length === 0) {
			return fsPath
		}

		// Try to find a workspace folder that contains this path
		for (const folder of this.workspaceFolders) {
			const workspacePath = folder.uri.fsPath

			// Normalize paths for comparison (handle different path separators)
			const normalizedFsPath = path.normalize(fsPath)
			const normalizedWorkspacePath = path.normalize(workspacePath)

			// Check if the path is within this workspace folder
			if (normalizedFsPath.startsWith(normalizedWorkspacePath)) {
				// Get the relative path
				let relativePath = path.relative(normalizedWorkspacePath, normalizedFsPath)

				// If includeWorkspaceFolder is true and there are multiple workspace folders,
				// prepend the workspace folder name
				if (includeWorkspaceFolder && this.workspaceFolders.length > 1) {
					relativePath = path.join(folder.name, relativePath)
				}

				return relativePath
			}
		}

		// If not within any workspace folder, return the original path
		return fsPath
	}

	onDidChangeWorkspaceFolders(listener: (event: WorkspaceFoldersChangeEvent) => void): Disposable {
		return this._onDidChangeWorkspaceFolders.event(listener)
	}
	onDidChangeConfiguration(listener: (event: ConfigurationChangeEvent) => void): Disposable {
		return new EventEmitter<ConfigurationChangeEvent>().event(listener)
	}
	onDidChangeTextDocument(listener: (event: TextDocumentChangeEvent) => void): Disposable {
		return this._onDidChangeTextDocument.event(listener)
	}
	onDidOpenTextDocument(listener: (event: TextDocument) => void): Disposable {
		return this._onDidOpenTextDocument.event(listener)
	}
	onDidCloseTextDocument(listener: (event: TextDocument) => void): Disposable {
		return this._onDidCloseTextDocument.event(listener)
	}

	getConfiguration(section?: string): WorkspaceConfiguration {
		return new MockWorkspaceConfiguration(section, this.context)
	}
	findFiles(): Thenable<Uri[]> {
		return Promise.resolve([])
	}

	async openTextDocument(uri: Uri): Promise<TextDocument> {
		logs.debug(`openTextDocument called for: ${uri.fsPath}`, "VSCode.Workspace")
		let content = ""
		try {
			content = fs.readFileSync(uri.fsPath, "utf-8")
		} catch (error) {
			logs.warn(`Failed to read file: ${uri.fsPath}`, "VSCode.Workspace", { error })
		}

		const lines = content.split("\n")
		const document: TextDocument = {
			uri,
			fileName: uri.fsPath,
			languageId: "plaintext",
			version: 1,
			isDirty: false,
			isClosed: false,
			lineCount: lines.length,
			getText: (range?: Range) =>
				!range ? content : lines.slice(range.start.line, range.end.line + 1).join("\n"),
			lineAt: (line: number): TextLine => {
				const text = lines[line] || ""
				return {
					text,
					range: new Range(new Position(line, 0), new Position(line, text.length)),
					rangeIncludingLineBreak: new Range(new Position(line, 0), new Position(line + 1, 0)),
					firstNonWhitespaceCharacterIndex: text.search(/\S/),
					isEmptyOrWhitespace: text.trim().length === 0,
				}
			},
			offsetAt: (position: Position) => {
				let offset = 0
				for (let i = 0; i < position.line && i < lines.length; i++) offset += (lines[i]?.length || 0) + 1
				return offset + position.character
			},
			positionAt: (offset: number) => {
				let currentOffset = 0
				for (let i = 0; i < lines.length; i++) {
					const lineLength = (lines[i]?.length || 0) + 1
					if (currentOffset + lineLength > offset) return new Position(i, offset - currentOffset)
					currentOffset += lineLength
				}
				return new Position(lines.length - 1, lines[lines.length - 1]?.length || 0)
			},
			save: () => Promise.resolve(true),
			validateRange: (range: Range) => range,
			validatePosition: (position: Position) => position,
		}

		this.textDocuments.push(document)
		await new Promise((resolve) => setTimeout(resolve, 10))
		this._onDidOpenTextDocument.fire(document)
		return document
	}

	async applyEdit(edit: WorkspaceEdit): Promise<boolean> {
		try {
			for (const [uri, edits] of edit.entries()) {
				let filePath = uri.fsPath
				if (process.platform === "win32" && filePath.startsWith("/")) {
					filePath = filePath.slice(1)
				}

				const newContent = applyEditsToFile(filePath, edits)

				const document = this.textDocuments.find((doc: TextDocument) => doc.uri.fsPath === filePath)
				if (document) {
					updateDocumentAfterEdit(document, newContent)
				}
			}
			return true
		} catch (error) {
			logs.error("Failed to apply workspace edit", "VSCode.Workspace", { error })
			return false
		}
	}

	createFileSystemWatcher(): FileSystemWatcher {
		const emitter = new EventEmitter<Uri>()
		return {
			onDidChange: (listener: (e: Uri) => void) => emitter.event(listener),
			onDidCreate: (listener: (e: Uri) => void) => emitter.event(listener),
			onDidDelete: (listener: (e: Uri) => void) => emitter.event(listener),
			dispose: () => emitter.dispose(),
		}
	}
	registerTextDocumentContentProvider(): Disposable {
		return { dispose: () => {} }
	}
}
