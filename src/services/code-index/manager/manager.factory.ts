import * as vscode from "vscode"

import { CodeIndexManager } from "./manager"

const _instances = new Map<string, CodeIndexManager>()

export function getCodeIndexManager(
	context: vscode.ExtensionContext,
	workspacePath?: string,
): CodeIndexManager | undefined {
	let folder: vscode.WorkspaceFolder | undefined

	if (workspacePath) {
		folder = vscode.workspace.workspaceFolders?.find((f) => f.uri.fsPath === workspacePath)
	} else {
		const activeEditor = vscode.window.activeTextEditor
		if (activeEditor) {
			folder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri)
		}
		if (!folder) {
			const workspaceFolders = vscode.workspace.workspaceFolders
			if (!workspaceFolders || workspaceFolders.length === 0) {
				return undefined
			}
			folder = workspaceFolders[0]
		}
		workspacePath = folder.uri.fsPath
	}

	if (!_instances.has(workspacePath)) {
		const folderUri = folder?.uri ?? vscode.Uri.file(workspacePath)
		_instances.set(workspacePath, new CodeIndexManager(workspacePath, folderUri, context))
	}
	return _instances.get(workspacePath)!
}

export function getAllCodeIndexManagers(): CodeIndexManager[] {
	const managers = Array.from(_instances.values())
	return managers
}
