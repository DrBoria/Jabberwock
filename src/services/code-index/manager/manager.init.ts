import type { VscodeContextAccess } from "@features/foundation/vscode/context"

import { CodeIndexConfigManager } from "@services/code-index/config/manager"
import type { CodeIndexStateManager } from "@services/code-index/state-manager"
import type { CodeIndexOrchestrator } from "@services/code-index/orchestrator/orchestrator"

export function shouldSkipInitialization(
	isFeatureEnabled: boolean,
	orchestrator: CodeIndexOrchestrator | undefined,
	workspacePath: string | undefined,
	isWorkspaceEnabled: boolean,
	stateManager: CodeIndexStateManager,
): boolean {
	if (!isFeatureEnabled) {
		if (orchestrator) {
			orchestrator.stopWatcher()
		}
		return true
	}

	if (!workspacePath) {
		stateManager.setSystemState("Standby", "No workspace folder open")
		return true
	}

	if (!isWorkspaceEnabled) {
		stateManager.setSystemState("Standby", "Indexing not enabled for this workspace")
		return true
	}

	return false
}

export function shouldStartOrRestartIndexing(
	requiresRestart: boolean,
	needsServiceRecreation: boolean,
	orchestrator: CodeIndexOrchestrator | undefined,
): boolean {
	return requiresRestart || (needsServiceRecreation && (!orchestrator || orchestrator.state !== "Indexing"))
}

export function getOrCreateConfigManager(
	configManager: CodeIndexConfigManager | undefined,
	contextProxy: VscodeContextAccess,
): CodeIndexConfigManager {
	if (configManager) {
		return configManager
	}
	return new CodeIndexConfigManager(contextProxy)
}
