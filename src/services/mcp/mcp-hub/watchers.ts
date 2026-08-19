import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"

import { McpSettingsSchema } from "@services/mcp/config/schemas"
import { t } from "@i18n"
import { getWorkspacePath } from "@utils/io/path"

import type { McpHubState } from "@services/mcp/core/types"
import { showErrorMessage } from "./init"

// ─── Watch MCP settings file ─────────────────────────────────────────

export function watchMcpSettingsFile(
	state: McpHubState,
	getMcpSettingsFilePath: () => Promise<string>,
	debounceFn: (filePath: string, source: "global" | "project") => void,
): void {
	if (process.env.NODE_ENV === "test" || !vscode.workspace.createFileSystemWatcher) {
		return
	}

	if (state.settingsWatcher) {
		state.settingsWatcher.dispose()
		state.settingsWatcher = undefined
	}

	getMcpSettingsFilePath().then((settingsPath) => {
		const settingsPattern = new vscode.RelativePattern(path.dirname(settingsPath), path.basename(settingsPath))

		state.settingsWatcher = vscode.workspace.createFileSystemWatcher(settingsPattern)

		const changeDisposable = state.settingsWatcher.onDidChange((uri) => {
			if (uri.fsPath === settingsPath) {
				debounceFn(settingsPath, "global")
			}
		})

		const createDisposable = state.settingsWatcher.onDidCreate((uri) => {
			if (uri.fsPath === settingsPath) {
				debounceFn(settingsPath, "global")
			}
		})

		state.disposables.push(vscode.Disposable.from(changeDisposable, createDisposable, state.settingsWatcher!))
	})
}

// ─── Watch project MCP file ──────────────────────────────────────────

export async function watchProjectMcpFile(
	state: McpHubState,
	debounceFn: (filePath: string, source: "global" | "project") => void,
	cleanupProjectMcpServers: () => Promise<void>,
	notifyWebview: () => Promise<void>,
): Promise<void> {
	if (process.env.NODE_ENV === "test" || !vscode.workspace.createFileSystemWatcher) {
		return
	}

	if (state.projectMcpWatcher) {
		state.projectMcpWatcher.dispose()
		state.projectMcpWatcher = undefined
	}

	if (!vscode.workspace.workspaceFolders?.length) {
		return
	}

	const workspaceFolder = getWorkspacePath()
	const projectMcpPattern = new vscode.RelativePattern(workspaceFolder, ".jabberwock/mcp.json")

	state.projectMcpWatcher = vscode.workspace.createFileSystemWatcher(projectMcpPattern)

	const changeDisposable = state.projectMcpWatcher.onDidChange((uri) => {
		debounceFn(uri.fsPath, "project")
	})

	const createDisposable = state.projectMcpWatcher.onDidCreate((uri) => {
		debounceFn(uri.fsPath, "project")
	})

	const deleteDisposable = state.projectMcpWatcher.onDidDelete(async () => {
		await cleanupProjectMcpServers()
		await notifyWebview()
		vscode.window.showInformationMessage(t("mcp:info.project_config_deleted"))
	})

	state.disposables.push(
		vscode.Disposable.from(changeDisposable, createDisposable, deleteDisposable, state.projectMcpWatcher),
	)
}

// ─── Setup workspace folders watcher ─────────────────────────────────

export function setupWorkspaceFoldersWatcher(
	state: McpHubState,
	updateProjectMcpServers: () => Promise<void>,
	watchProjectMcp: () => Promise<void>,
): void {
	if (process.env.NODE_ENV === "test") {
		return
	}

	state.disposables.push(
		vscode.workspace.onDidChangeWorkspaceFolders(async () => {
			await updateProjectMcpServers()
			await watchProjectMcp()
		}),
	)
}

// ─── Update project MCP servers ──────────────────────────────────────

export async function updateProjectMcpServers(
	getProjectMcpPathFn: () => Promise<string | null>,
	updateServerConnections: (servers: Record<string, unknown>, source: "global" | "project") => Promise<void>,
): Promise<void> {
	try {
		const projectMcpPath = await getProjectMcpPathFn()
		if (!projectMcpPath) return

		const content = await fs.readFile(projectMcpPath, "utf-8")
		let config: unknown

		try {
			config = JSON.parse(content)
		} catch (parseError) {
			const errorMessage = t("mcp:errors.invalid_settings_syntax")
			console.error(errorMessage, parseError)
			vscode.window.showErrorMessage(errorMessage)
			return
		}

		const result = McpSettingsSchema.safeParse(config)
		if (result.success) {
			await updateServerConnections(result.data.mcpServers || {}, "project")
		} else {
			const errorMessages = result.error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join("\n")
			console.error("[jabberwock] Invalid project MCP settings format:", errorMessages)
			vscode.window.showErrorMessage(t("mcp:errors.invalid_settings_validation", { errorMessages }))
		}
	} catch (error) {
		showErrorMessage(t("mcp:errors.failed_update_project"), error)
	}
}

// ─── Cleanup project MCP servers ─────────────────────────────────────

export async function cleanupProjectMcpServers(
	state: McpHubState,
	deleteConnectionFn: (name: string, source?: "global" | "project") => Promise<void>,
): Promise<void> {
	const projectConnections = state.connections.filter((conn) => conn.server.source === "project")

	for (const conn of projectConnections) {
		await deleteConnectionFn(conn.server.name, "project")
	}

	state.connections = state.connections.filter((conn) => conn.server.source !== "project")
}

// ─── Programmatic update flag helpers ────────────────────────────────

export function setProgrammaticUpdateFlag(state: McpHubState): void {
	if (state.flagResetTimer) {
		clearTimeout(state.flagResetTimer)
	}
	state.isProgrammaticUpdate = true
}

export function resetProgrammaticUpdateFlag(state: McpHubState): void {
	state.flagResetTimer = setTimeout(() => {
		state.isProgrammaticUpdate = false
		state.flagResetTimer = undefined
	}, 600)
}

// ─── File watcher management ─────────────────────────────────────────

export function removeAllFileWatchers(state: McpHubState): void {
	state.fileWatchers.forEach((watchers) => watchers.forEach((watcher) => watcher.close()))
	state.fileWatchers.clear()
}

export function removeFileWatchersForServer(state: McpHubState, serverName: string): void {
	const watchers = state.fileWatchers.get(serverName)
	if (watchers) {
		watchers.forEach((watcher) => watcher.close())
		state.fileWatchers.delete(serverName)
	}
}
