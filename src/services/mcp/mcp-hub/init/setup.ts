import type { McpHubState } from "@services/mcp/core/types"
import { initializeMcpServers, debounceConfigChange, handleConfigFileChange } from "./init"
import {
	watchMcpSettingsFile,
	watchProjectMcpFile,
	setupWorkspaceFoldersWatcher,
	updateProjectMcpServers,
	cleanupProjectMcpServers,
} from "@services/mcp/mcp-hub/watchers"

export interface HubDeps {
	buildState(): McpHubState
	getMcpSettingsFilePath(): Promise<string>
	getProjectMcpPath(): Promise<string | null>
	notifyWebviewOfServerChanges(): Promise<void>
	deleteConnection(name: string, source?: "global" | "project"): Promise<void>
	updateServerConnections(
		newServers: Record<string, unknown>,
		source: "global" | "project",
		manageConnectingState?: boolean,
	): Promise<void>
	configChangeDebounceTimers: Map<string, NodeJS.Timeout>
}

export async function setupWatchers(deps: HubDeps): Promise<void> {
	watchMcpSettingsFile(
		deps.buildState(),
		() => deps.getMcpSettingsFilePath(),
		(filePath, source) =>
			debounceConfigChange(deps.buildState(), filePath, source, () =>
				handleConfigChangeWithNotify(deps, filePath, source),
			),
	)

	await watchProjectMcpFile(
		deps.buildState(),
		(filePath, source) =>
			debounceConfigChange(deps.buildState(), filePath, source, () =>
				handleConfigChangeWithNotify(deps, filePath, source),
			),
		() =>
			cleanupProjectMcpServers(deps.buildState(), (name, src) =>
				deps.deleteConnection(name, src as "global" | "project"),
			),
		() => deps.notifyWebviewOfServerChanges(),
	)

	setupWorkspaceFoldersWatcher(
		deps.buildState(),
		() =>
			updateProjectMcpServers(
				() => deps.getProjectMcpPath(),
				(servers, source) =>
					deps.updateServerConnections(servers as Record<string, unknown>, source as "global" | "project"),
			),
		() => setupWatchers(deps),
	)
}

async function handleConfigChangeWithNotify(
	deps: HubDeps,
	filePath: string,
	source: "global" | "project",
): Promise<void> {
	await handleConfigFileChange(
		deps.buildState(),
		filePath,
		source,
		(servers, s) => deps.updateServerConnections(servers as Record<string, unknown>, s as "global" | "project"),
		() =>
			cleanupProjectMcpServers(deps.buildState(), (name, src) =>
				deps.deleteConnection(name, src as "global" | "project"),
			),
		() => deps.notifyWebviewOfServerChanges(),
	)
	await deps.notifyWebviewOfServerChanges()
}

export async function initializeAllServers(deps: HubDeps): Promise<void> {
	await initializeMcpServers(
		deps.buildState(),
		"global",
		() => deps.getMcpSettingsFilePath(),
		() => deps.getProjectMcpPath(),
		(servers, s, manageState) =>
			deps.updateServerConnections(servers as Record<string, unknown>, s as "global" | "project", manageState),
	)
	await initializeMcpServers(
		deps.buildState(),
		"project",
		() => deps.getMcpSettingsFilePath(),
		() => deps.getProjectMcpPath(),
		(servers, s, manageState) =>
			deps.updateServerConnections(servers as Record<string, unknown>, s as "global" | "project", manageState),
	)
}
