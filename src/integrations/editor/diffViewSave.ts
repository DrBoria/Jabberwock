import * as vscode from "vscode"
import * as path from "path"

import { type SayToolData, DEFAULT_WRITE_DELAY_MS } from "@jabberwock/types"
import { createDirectoriesForFile } from "@utils/io/fs"
import { getReadablePath } from "@utils/io/path"
import type { ITaskModel } from "@features/chat/task/store"
import { userBroadcast } from "@features/chat/task/messages/actions/say"
import { getVirtualWorkspace } from "@features/foundation/time-machine/actions/getTimeMachine"

import { closeAllDiffViews } from "./diffViewEditorOps"
import { stripAllBOMs, detectUserEdits, getNewDiagnosticsMessage } from "./diffViewHelpers"
import type { DiffViewProvider } from "./DiffViewProvider"

// eslint-disable-next-line complexity -- Handles multiple save strategies (direct write, diff, file create) with error recovery
export async function saveChanges(
	provider: DiffViewProvider,
	diagnosticsEnabled: boolean = true,
	writeDelayMs: number = DEFAULT_WRITE_DELAY_MS,
): Promise<{
	newProblemsMessage: string | undefined
	userEdits: string | undefined
	finalContent: string | undefined
}> {
	if (
		!provider.relPath ||
		!provider.newContent ||
		!provider.activeDiffEditor ||
		!provider.cwd ||
		!provider.preDiagnostics
	) {
		return { newProblemsMessage: undefined, userEdits: undefined, finalContent: undefined }
	}
	const absolutePath = path.resolve(provider.cwd, provider.relPath)
	const updatedDocument = provider.activeDiffEditor.document
	const editedContent = updatedDocument.getText()
	const vfs = getVirtualWorkspace()
	if (!vfs) {
		throw new Error("Task virtual workspace not available")
	}
	await vfs.writeFile(absolutePath, editedContent)
	if (updatedDocument.isDirty) {
		await updatedDocument.save()
	}
	await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), { preview: false, preserveFocus: true })
	await closeAllDiffViews()
	const newProblemsMessage = diagnosticsEnabled
		? await getNewDiagnosticsMessage(provider.preDiagnostics, provider.cwd, writeDelayMs)
		: ""
	const { userEdits, finalContent } = detectUserEdits(provider.relPath, editedContent, provider.newContent)
	provider.newProblemsMessage = newProblemsMessage
	provider.userEdits = userEdits
	return { newProblemsMessage, userEdits, finalContent }
}

export async function pushToolWriteResult(
	provider: DiffViewProvider,
	task: ITaskModel,
	cwd: string,
	isNewFile: boolean,
): Promise<string> {
	if (!provider.relPath) {
		throw new Error("No file path available in DiffViewProvider")
	}
	if (provider.userEdits) {
		const sayPayload: SayToolData = {
			tool: isNewFile ? "newFileCreated" : "editedExistingFile",
			path: getReadablePath(cwd, provider.relPath),
			diff: provider.userEdits,
		}
		await userBroadcast(task.taskId, "user_feedback_diff", JSON.stringify(sayPayload))
	}
	const notices = [
		"You do not need to re-read the file, as you have seen all changes",
		"Proceed with the task using these changes as the new baseline.",
		...(provider.userEdits
			? [
					"If the user's edits have addressed part of the task or changed the requirements, adjust your approach accordingly.",
				]
			: []),
	]
	const result: {
		path: string
		operation: "created" | "modified"
		notice: string
		user_edits?: string
		problems?: string
	} = {
		path: provider.relPath,
		operation: isNewFile ? "created" : "modified",
		notice: notices.join(" "),
	}
	if (provider.userEdits) {
		result.user_edits = provider.userEdits
	}
	if (provider.newProblemsMessage) {
		result.problems = provider.newProblemsMessage
	}
	return JSON.stringify(result)
}

export async function revertChanges(provider: DiffViewProvider): Promise<void> {
	if (!provider.relPath || !provider.activeDiffEditor || !provider.cwd) {
		return
	}
	const fileExists = provider.editType === "modify"
	const updatedDocument = provider.activeDiffEditor.document
	const absolutePath = path.resolve(provider.cwd, provider.relPath)
	if (!fileExists) {
		if (updatedDocument.isDirty) {
			await updatedDocument.save()
		}
		await closeAllDiffViews()
		const vfs = getVirtualWorkspace()
		if (vfs) {
			await vfs.unlink(absolutePath)
			for (let i = provider.createdDirs.length - 1; i >= 0; i--) {
				await vfs.rmdir(provider.createdDirs[i])
			}
		}
	} else {
		const edit = new vscode.WorkspaceEdit()
		const fullRange = new vscode.Range(
			updatedDocument.positionAt(0),
			updatedDocument.positionAt(updatedDocument.getText().length),
		)
		edit.replace(updatedDocument.uri, fullRange, stripAllBOMs(provider.originalContent ?? ""))
		await vscode.workspace.applyEdit(edit)
		await updatedDocument.save()
		if (provider.documentWasOpen) {
			await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), {
				preview: false,
				preserveFocus: true,
			})
		}
		await closeAllDiffViews()
	}
}

export async function saveDirectly(
	provider: DiffViewProvider,
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
	if (!provider.cwd) {
		return { newProblemsMessage: undefined, userEdits: undefined, finalContent: undefined }
	}
	const absolutePath = path.resolve(provider.cwd, relPath)
	const vfs = getVirtualWorkspace()
	if (!vfs) {
		throw new Error("Task virtual workspace not available")
	}
	provider.preDiagnostics = vscode.languages.getDiagnostics()
	await createDirectoriesForFile(absolutePath, vfs)
	await vfs.writeFile(absolutePath, content)
	if (openFile) {
		await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), {
			preview: false,
			preserveFocus: true,
		})
	} else {
		const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(absolutePath))
		if (doc.isDirty) {
			await doc.save()
		}
		await new Promise((resolve) => setTimeout(resolve, 100))
	}
	const newProblemsMessage = diagnosticsEnabled
		? await getNewDiagnosticsMessage(provider.preDiagnostics, provider.cwd, writeDelayMs)
		: ""
	provider.newProblemsMessage = newProblemsMessage
	provider.userEdits = undefined
	provider.relPath = relPath
	provider.newContent = content
	return { newProblemsMessage, userEdits: undefined, finalContent: content }
}
