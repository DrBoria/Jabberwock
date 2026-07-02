import * as fs from "fs/promises"
import * as path from "path"

import * as vscode from "vscode"
import * as yaml from "yaml"

import { GlobalFileNames } from "@shared/globalFileNames"
import { ensureSettingsDirectoryExists } from "@utils/globalContext"

async function checkModesInFile(filePath: string, metadata: Record<string, { type: string }>): Promise<void> {
	try {
		const content = await fs.readFile(filePath, "utf-8")
		const data = yaml.parse(content)
		if (data?.customModes && Array.isArray(data.customModes)) {
			for (const mode of data.customModes) {
				if (mode.slug) {
					metadata[mode.slug] = {
						type: "mode",
					}
				}
			}
		}
	} catch {
		// File doesn't exist or can't be read, skip
	}
}

async function checkMcpsInFile(filePath: string, metadata: Record<string, { type: string }>): Promise<void> {
	try {
		const content = await fs.readFile(filePath, "utf-8")
		const data = JSON.parse(content)
		if (data?.mcpServers && typeof data.mcpServers === "object") {
			for (const serverName of Object.keys(data.mcpServers)) {
				metadata[serverName] = {
					type: "mcp",
				}
			}
		}
	} catch {
		// File doesn't exist or can't be read, skip
	}
}

async function checkProjectInstallations(metadata: Record<string, { type: string }>): Promise<void> {
	try {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
		if (!workspaceFolder) {
			return
		}

		const projectModesPath = path.join(workspaceFolder.uri.fsPath, ".jabberwockmodes")
		await checkModesInFile(projectModesPath, metadata)

		const projectMcpPath = path.join(workspaceFolder.uri.fsPath, ".jabberwock", "mcp.json")
		await checkMcpsInFile(projectMcpPath, metadata)
	} catch (error) {
		console.error("[jabberwock] Error checking project installations:", error)
	}
}

async function checkGlobalInstallations(
	context: vscode.ExtensionContext,
	metadata: Record<string, { type: string }>,
): Promise<void> {
	try {
		const globalSettingsPath = await ensureSettingsDirectoryExists(context)

		const globalModesPath = path.join(globalSettingsPath, GlobalFileNames.customModes)
		await checkModesInFile(globalModesPath, metadata)

		const globalMcpPath = path.join(globalSettingsPath, GlobalFileNames.mcpSettings)
		await checkMcpsInFile(globalMcpPath, metadata)
	} catch (error) {
		console.error("[jabberwock] Error checking global installations:", error)
	}
}

export async function getInstallationMetadata(context: vscode.ExtensionContext): Promise<{
	project: Record<string, { type: string }>
	global: Record<string, { type: string }>
}> {
	const metadata = {
		project: {} as Record<string, { type: string }>,
		global: {} as Record<string, { type: string }>,
	}

	await checkProjectInstallations(metadata.project)
	await checkGlobalInstallations(context, metadata.global)

	return metadata
}
