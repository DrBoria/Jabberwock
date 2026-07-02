import * as vscode from "vscode"
import * as path from "path"

import { DEFAULT_WRITE_DELAY_MS } from "@jabberwock/types"
import { createDirectoriesForFile } from "@utils/io/fs"
import { arePathsEqual } from "@utils/io/path"
import type { ITaskModel } from "@features/chat/task/store"
import { DecorationController } from "./DecorationController"
import { getVirtualWorkspace } from "@features/foundation/time-machine/actions/getTimeMachine"
import {
	DIFF_VIEW_URI_SCHEME_JABBERWOCK,
	DIFF_VIEW_LABEL_CHANGES,
	scrollToFirstDiff as scrollToFirstDiffHelper,
	scrollEditorToLine as scrollEditorToLineHelper,
} from "./diffViewHelpers"
import { closeAllDiffViews, openDiffEditor, applyStreamingEdit, applyFinalEdits } from "./diffViewEditorOps"
import { saveChanges, pushToolWriteResult, revertChanges, saveDirectly } from "./diffViewSave"

export { DIFF_VIEW_URI_SCHEME_JABBERWOCK, DIFF_VIEW_LABEL_CHANGES }

export class DiffViewProvider {
	newProblemsMessage?: string
	userEdits?: string
	editType?: "create" | "modify"
	isEditing = false
	originalContent: string | undefined
	relPath?: string
	newContent?: string
	activeDiffEditor?: vscode.TextEditor
	cwd: string
	preDiagnostics: [vscode.Uri, vscode.Diagnostic[]][] = []
	createdDirs: string[] = []
	documentWasOpen = false
	private fadedOverlayController?: DecorationController
	private activeLineController?: DecorationController
	private streamedLines: string[] = []
	private taskRef: WeakRef<ITaskModel>

	constructor(cwd: string, task: ITaskModel) {
		this.cwd = cwd
		this.taskRef = new WeakRef(task)
	}

	async open(relPath: string): Promise<void> {
		this.relPath = relPath
		const fileExists = this.editType === "modify"
		const absolutePath = path.resolve(this.cwd, relPath)
		this.isEditing = true

		if (fileExists) {
			const existingDocument = vscode.workspace.textDocuments.find(
				(doc) => doc.uri.scheme === "file" && arePathsEqual(doc.uri.fsPath, absolutePath),
			)
			if (existingDocument && existingDocument.isDirty) {
				await existingDocument.save()
			}
		}
		this.preDiagnostics = vscode.languages.getDiagnostics()
		const vfs = getVirtualWorkspace()
		if (!vfs) {
			throw new Error("Task virtual workspace not available")
		}
		this.originalContent = fileExists ? await vfs.readFile(absolutePath) : ""
		this.createdDirs = await createDirectoriesForFile(absolutePath, vfs)
		if (!fileExists) {
			await vfs.writeFile(absolutePath, "")
		}
		this.documentWasOpen = false
		const tabs = vscode.window.tabGroups.all
			.map((tg) => tg.tabs)
			.flat()
			.filter(
				(tab) =>
					tab.input instanceof vscode.TabInputText &&
					tab.input.uri.scheme === "file" &&
					arePathsEqual(tab.input.uri.fsPath, absolutePath),
			)
		for (const tab of tabs) {
			if (!tab.isDirty) {
				try {
					await vscode.window.tabGroups.close(tab)
				} catch (err) {
					console.error(`[jabberwock] Failed to close tab ${tab.label}`, err)
				}
			}
			this.documentWasOpen = true
		}
		this.activeDiffEditor = await openDiffEditor(relPath, this.cwd, this.editType, this.originalContent)
		this.fadedOverlayController = new DecorationController("fadedOverlay", this.activeDiffEditor)
		this.activeLineController = new DecorationController("activeLine", this.activeDiffEditor)
		this.fadedOverlayController.addLines(0, this.activeDiffEditor.document.lineCount)
		scrollEditorToLineHelper(this.activeDiffEditor, 0)
		this.streamedLines = []
	}

	isFullyInitialized(): boolean {
		return (
			this.relPath !== undefined &&
			this.activeLineController !== undefined &&
			this.fadedOverlayController !== undefined
		)
	}

	async update(accumulatedContent: string, isFinal: boolean) {
		if (!this.isFullyInitialized()) {
			throw new Error("Required values not set")
		}
		this.newContent = accumulatedContent
		const accumulatedLines = accumulatedContent.split("\n")
		if (!isFinal) {
			accumulatedLines.pop()
		}
		const diffEditor = this.activeDiffEditor
		const document = diffEditor?.document
		if (!diffEditor || !document) {
			throw new Error("User closed text editor, unable to edit file...")
		}
		const beginningOfDocument = new vscode.Position(0, 0)
		diffEditor.selection = new vscode.Selection(beginningOfDocument, beginningOfDocument)
		await applyStreamingEdit(
			document,
			accumulatedLines,
			diffEditor,
			this.fadedOverlayController!,
			this.activeLineController!,
		)
		this.streamedLines = accumulatedLines
		if (isFinal) {
			await applyFinalEdits(
				document,
				accumulatedContent,
				this.streamedLines,
				this.originalContent,
				this.fadedOverlayController!,
				this.activeLineController!,
			)
		}
	}

	scrollToFirstDiff() {
		scrollToFirstDiffHelper(this.activeDiffEditor, this.originalContent ?? "")
	}

	async saveChanges(
		diagnosticsEnabled: boolean = true,
		writeDelayMs: number = DEFAULT_WRITE_DELAY_MS,
	): Promise<{
		newProblemsMessage: string | undefined
		userEdits: string | undefined
		finalContent: string | undefined
	}> {
		return saveChanges(this, diagnosticsEnabled, writeDelayMs)
	}

	async pushToolWriteResult(task: ITaskModel, cwd: string, isNewFile: boolean): Promise<string> {
		return pushToolWriteResult(this, task, cwd, isNewFile)
	}

	async revertChanges(): Promise<void> {
		await revertChanges(this)
	}

	async reset(): Promise<void> {
		await closeAllDiffViews()
		this.editType = undefined
		this.isEditing = false
		this.originalContent = undefined
		this.createdDirs = []
		this.documentWasOpen = false
		this.activeDiffEditor = undefined
		this.fadedOverlayController = undefined
		this.activeLineController = undefined
		this.streamedLines = []
		this.preDiagnostics = []
	}

	async saveDirectly(
		relPath: string,
		content: string,
		openFile: boolean = true,
		diagnosticsEnabled: boolean = true,
		writeDelayMs: number = DEFAULT_WRITE_DELAY_MS,
	): Promise<{
		newProblemsMessage: string | undefined
		userEdits: string | undefined
		finalContent: string | undefined
	}> {
		return saveDirectly(this, relPath, content, openFile, diagnosticsEnabled, writeDelayMs)
	}
}
