// v4 B2 (L6): file-watcher creation routes through the fileWatchers capability slot (vscode mode:
// createFileSystemWatcher; server mode: chokidar); L12 error sites publish to pubsub instead of
// calling vscode.window directly.
import * as fs from "fs/promises"
import * as path from "path"

import type { IFileWatcher } from "@jabberwock/types"
import { McpSettingsSchema } from "@services/mcp/config/schemas"
import { t } from "@i18n"
import { getWorkspacePath } from "@utils/io/path"
import { onWorkspaceFoldersChanged, getHostContext } from "@features/foundation/host-context/context"
import { publishNotificationError } from "@features/foundation/capabilities/notifications"
import { getFileWatchers, getUiDialogs } from "@features/foundation/capabilities/registry"

import type { McpHubState } from "@services/mcp/core/types"
import { showErrorMessage } from "./init"

// ─── Watch MCP settings file ─────────────────────────────────────────

export function watchMcpSettingsFile(
	state: McpHubState,
	getMcpSettingsFilePath: () => Promise<string>,
	debounceFn: (filePath: string, source: "global" | "project") => void,
): void {
	if (process.env.NODE_ENV === "test" || !getFileWatchers()) {
		return
	}

	if (state.settingsWatcher) {
		state.settingsWatcher.dispose()
		state.settingsWatcher = undefined
	}

	getMcpSettingsFilePath().then(async (settingsPath) => {
		const factory = getFileWatchers()
		if (!factory) {
			return
		}

		// D4g-2 (batch 2): the file watcher is created through the fileWatchers capability slot
		// instead of importing "vscode" (plan §3.2 Strategy E). The absolute path is adapted to a
		// host RelativePattern by the vscode factory; chokidar watches it directly.
		const watcher = await factory.watch([settingsPath])
		state.settingsWatcher = watcher

		const changeDisposable = watcher.onChange?.((changedPath) => {
			if (changedPath === settingsPath) {
				debounceFn(settingsPath, "global")
			}
		})
		const createDisposable = watcher.onCreate?.((createdPath) => {
			if (createdPath === settingsPath) {
				debounceFn(settingsPath, "global")
			}
		})

		// Composite disposal — same lifetime semantics as the pre-conversion vscode.Disposable.from(...).
		state.disposables.push({
			dispose: () => {
				changeDisposable?.dispose()
				createDisposable?.dispose()
				watcher.close()
			},
		})
	})
}

// ─── Watch project MCP file ──────────────────────────────────────────

/**
 * D4g-2 (batch 2): bind the change/create/delete handlers to the project MCP watcher and push a
 * composite disposable onto the hub state. Extracted from `watchProjectMcpFile` to keep the
 * caller's cyclomatic complexity within the lint budget.
 */
function attachProjectMcpWatcher(
	state: McpHubState,
	watcher: IFileWatcher,
	debounceFn: (filePath: string, source: "global" | "project") => void,
	cleanupProjectMcpServers: () => Promise<void>,
	notifyWebview: () => Promise<void>,
): void {
	const changeDisposable = watcher.onChange?.((changedPath) => {
		debounceFn(changedPath, "project")
	})
	const createDisposable = watcher.onCreate?.((createdPath) => {
		debounceFn(createdPath, "project")
	})
	const deleteDisposable = watcher.onDelete?.(async () => {
		await cleanupProjectMcpServers()
		await notifyWebview()
		// D4g-2 (batch 2): info toast through the uiDialogs slot instead of importing "vscode".
		await getUiDialogs().showInformationMessage(t("mcp:info.project_config_deleted"))
	})

	// Composite disposal — same lifetime semantics as the pre-conversion vscode.Disposable.from(...).
	state.disposables.push({
		dispose: () => {
			changeDisposable?.dispose()
			createDisposable?.dispose()
			deleteDisposable?.dispose()
			watcher.close()
		},
	})
}

export async function watchProjectMcpFile(
	state: McpHubState,
	debounceFn: (filePath: string, source: "global" | "project") => void,
	cleanupProjectMcpServers: () => Promise<void>,
	notifyWebview: () => Promise<void>,
): Promise<void> {
	if (process.env.NODE_ENV === "test" || !getFileWatchers()) {
		return
	}

	if (state.projectMcpWatcher) {
		state.projectMcpWatcher.dispose()
		state.projectMcpWatcher = undefined
	}

	if (!getHostContext()?.workspaceFolders?.length) {
		return
	}

	const workspaceFolder = getWorkspacePath()
	const factory = getFileWatchers()
	if (!factory) {
		return
	}

	// D4g-2 (batch 2): the project MCP watcher is created through the fileWatchers capability slot
	// instead of importing "vscode" (plan §3.2 Strategy E).
	const watcher = await factory.watch([path.join(workspaceFolder, ".jabberwock/mcp.json")])
	state.projectMcpWatcher = watcher
	attachProjectMcpWatcher(state, watcher, debounceFn, cleanupProjectMcpServers, notifyWebview)
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
