import * as path from "path"

import * as vscode from "vscode"

import { GlobalFileNames } from "@shared/globalFileNames"
import { ensureSettingsDirectoryExists } from "@utils/globalContext"

export async function getModeFilePath(target: "project" | "global", context: vscode.ExtensionContext): Promise<string> {
	if (target === "project") {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
		if (!workspaceFolder) {
			throw new Error("No workspace folder found")
		}
		return path.join(workspaceFolder.uri.fsPath, ".jabberwockmodes")
	}
	const globalSettingsPath = await ensureSettingsDirectoryExists(context)
	return path.join(globalSettingsPath, GlobalFileNames.customModes)
}

export async function getMcpFilePath(target: "project" | "global", context: vscode.ExtensionContext): Promise<string> {
	if (target === "project") {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
		if (!workspaceFolder) {
			throw new Error("No workspace folder found")
		}
		return path.join(workspaceFolder.uri.fsPath, ".jabberwock", "mcp.json")
	}
	const globalSettingsPath = await ensureSettingsDirectoryExists(context)
	return path.join(globalSettingsPath, GlobalFileNames.mcpSettings)
}
