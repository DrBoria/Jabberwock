import type { CodeIndexStateManager } from "@services/code-index/state-manager"

export async function recoverManagerFromError(stateManager: CodeIndexStateManager): Promise<void> {
	try {
		stateManager.setSystemState("Standby", "")
	} catch (error) {
		console.error("[jabberwock] Failed to clear error state during recovery:", error)
	}
}

export function disposeManager(stopIndexing: () => void, stateManager: CodeIndexStateManager): void {
	stopIndexing()
	stateManager.dispose()
}
