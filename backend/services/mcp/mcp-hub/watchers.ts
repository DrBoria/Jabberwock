// v4 B2 (L6): host FileSystemWatcher creation stays in this file until the connector-side factory exists (§2.3);
// L12 error sites below publish to pubsub instead of calling vscode.window directly.
import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"

// v4 B2 (L14): protocol DisposableLike for the adapter surface — no vscode types in McpHubState.
import type { DisposableLike } from "@jabberwock/types"

/** Concrete adapter surface — structurally satisfies the protocol `IFileWatcher` (required members are a subset of its optional ones). */
interface McpFileSystemWatcher {
	onChange(handler: (path: string) => void): DisposableLike
	onCreate(handler: (path: string) => void): DisposableLike
	close(): void
	dispose(): void
}

/** Project-MCP variant — additionally exposes the delete event with the exact protocol handler signature. */
interface ProjectMcpFileWatcher extends McpFileSystemWatcher {
	onDelete(handler: (path: string) => void): DisposableLike
}

import type { IHostUri } from "@features/foundation/host-context/context"

import { McpSettingsSchema } from "@services/mcp/config/schemas"
import { t } from "@i18n"
import { getWorkspacePath } from "@utils/io/path"
import { onWorkspaceFoldersChanged } from "@features/foundation/host-context/context"
import { publishNotificationError } from "@features/foundation/capabilities/notifications"

import type { McpHubState } from "@services/mcp/core/types"
import { showErrorMessage } from "./init"

/**
 * v4 B2 (L6): adapt the host FileSystemWatcher into a protocol-compatible watcher shape so
 * `McpHubState` stays free of vscode types (§2.3 L14). The connector-side factory replaces this adapter in Phase B3/B4.
 */
function adaptFileSystemWatcher(watcher: vscode.FileSystemWatcher): McpFileSystemWatcher {
	return {
		onChange: (handler) => watcher.onDidChange((uri) => handler(uri.fsPath)),
		onCreate: (handler) => watcher.onDidCreate((uri) => handler(uri.fsPath)),
		close: () => watcher.dispose(),
		dispose: () => watcher.dispose(),
	}
}

/** Project-MCP variant — additionally exposes the delete event. */
function adaptProjectMcpFileWatcher(watcher: vscode.FileSystemWatcher): ProjectMcpFileWatcher {
	return {
		...adaptFileSystemWatcher(watcher),
		onDelete: (handler) => watcher.onDidDelete((uri: IHostUri) => handler(uri.fsPath)), // structural URI view — no vscode type in the adapter surface
	}
}

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

		// v4 B2 (L6): concrete adapter type — protocol IFileWatcher members are optional, so handlers bind through the local.
		const settingsWatcherSource = vscode.workspace.createFileSystemWatcher(settingsPattern)
		const watcher: McpFileSystemWatcher = adaptFileSystemWatcher(settingsWatcherSource)
		state.settingsWatcher = watcher

		const changeDisposable = watcher.onChange((changedPath) => {
			if (changedPath === settingsPath) {
				debounceFn(settingsPath, "global")
			}
		})
		const createDisposable = watcher.onCreate((createdPath) => {
			if (createdPath === settingsPath) {
				debounceFn(settingsPath, "global")
			}
		})

		// Composite disposal — same lifetime semantics as the pre-conversion vscode.Disposable.from(...).
		state.disposables.push({
			dispose: () => {
				changeDisposable.dispose()
				createDisposable.dispose()
				watcher.close()
			},
		})
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

	// v4 B2 (L6): concrete adapter type — protocol IFileWatcher members are optional, so handlers bind through the local.
	const projectMcpSource = vscode.workspace.createFileSystemWatcher(projectMcpPattern)
	const watcher: ProjectMcpFileWatcher = adaptProjectMcpFileWatcher(projectMcpSource)
	state.projectMcpWatcher = watcher

	const changeDisposable = watcher.onChange((changedPath) => {
		debounceFn(changedPath, "project")
	})
	const createDisposable = watcher.onCreate((createdPath) => {
		debounceFn(createdPath, "project")
	})
	const deleteDisposable = watcher.onDelete(async () => {
		await cleanupProjectMcpServers()
		await notifyWebview()
		vscode.window.showInformationMessage(t("mcp:info.project_config_deleted")) // info toast — outside L12 error scope, stays until B3/B4
	})

	// Composite disposal — same lifetime semantics as the pre-conversion vscode.Disposable.from(...).
	state.disposables.push({
		dispose: () => {
			changeDisposable.dispose()
			createDisposable.dispose()
			deleteDisposable.dispose()
			watcher.close()
		},
	})
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

	// v4 B2 (L6): workspace-folder event via the host-context DI slot — no direct vscode call here.
	state.disposables.push(
		onWorkspaceFoldersChanged(async () => {
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
			publishNotificationError(errorMessage, parseError) // v4 B2 (L12): pubsub notification stream instead of vscode.window
			return
		}

		const result = McpSettingsSchema.safeParse(config)
		if (result.success) {
			await updateServerConnections(result.data.mcpServers || {}, "project")
		} else {
			const errorMessages = result.error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join("\n")
			console.error("[jabberwock] Invalid project MCP settings format:", errorMessages)
			publishNotificationError(t("mcp:errors.invalid_settings_validation", { errorMessages })) // v4 B2 (L12)
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
