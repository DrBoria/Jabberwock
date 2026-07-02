import type { McpHubState } from "@services/mcp/core/types"
import { removeAllFileWatchers } from "./watchers"
import { deleteConnection } from "./connection/manager"

export async function disposeHub(
	state: McpHubState,
	connections: import("@services/mcp/core/types").McpConnection[],
	settingsWatcher: { dispose(): void } | undefined,
	projectMcpWatcher: { dispose(): void } | undefined,
	disposables: { dispose(): void }[],
	configChangeDebounceTimers: Map<string, NodeJS.Timeout>,
	flagResetTimer: NodeJS.Timeout | undefined,
): Promise<void> {
	for (const timer of configChangeDebounceTimers.values()) {
		clearTimeout(timer)
	}
	configChangeDebounceTimers.clear()

	if (flagResetTimer) {
		clearTimeout(flagResetTimer)
	}

	removeAllFileWatchers(state)

	for (const connection of connections) {
		try {
			await deleteConnection(state, connection.server.name, connection.server.source)
		} catch (error) {
			console.error(`[jabberwock] Failed to close connection for ${connection.server.name}:`, error)
		}
	}

	if (settingsWatcher) {
		settingsWatcher.dispose()
	}

	if (projectMcpWatcher) {
		projectMcpWatcher.dispose()
	}

	disposables.forEach((d) => d.dispose())
}
