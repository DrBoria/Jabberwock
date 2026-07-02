import * as vscode from "vscode"

import { CacheManager } from "@services/code-index/cache-manager"
import type { CodeIndexConfigManager } from "@services/code-index/config/manager"
import type { CodeIndexStateManager } from "@services/code-index/state-manager"
import type { CodeIndexServiceFactory } from "@services/code-index/service-factory"
import type { CodeIndexOrchestrator } from "@services/code-index/orchestrator/orchestrator"
import type { CodeIndexSearchService } from "@services/code-index/search-service"
import { getTelemetryService } from "@jabberwock/telemetry"
import { TelemetryEventName } from "@jabberwock/types"

import { recreateManagerServices } from "./manager.services"

type ServiceSetters = {
	serviceFactory: CodeIndexServiceFactory | undefined
	orchestrator: CodeIndexOrchestrator | undefined
	searchService: CodeIndexSearchService | undefined
	cacheManager: CacheManager | undefined
}

async function recreateOnSettingsChange(
	configManager: CodeIndexConfigManager,
	stateManager: CodeIndexStateManager,
	context: vscode.ExtensionContext,
	workspacePath: string,
	orchestrator: CodeIndexOrchestrator | undefined,
	cacheManager: CacheManager | undefined,
	setServices: (services: ServiceSetters) => void,
): Promise<void> {
	try {
		let currentCache = cacheManager
		if (!currentCache) {
			currentCache = new CacheManager(context, workspacePath)
			await currentCache.initialize()
		}

		if (orchestrator) {
			orchestrator.stopWatcher()
		}

		const services = await recreateManagerServices(
			configManager,
			stateManager,
			currentCache,
			workspacePath,
			context,
			() => orchestrator?.stopWatcher(),
		)

		setServices({
			serviceFactory: services.serviceFactory,
			orchestrator: services.orchestrator,
			searchService: services.searchService,
			cacheManager: currentCache,
		})
	} catch (error) {
		console.error("[jabberwock] Failed to recreate services:", error)
		getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			location: "handleSettingsChange",
		})
		throw error
	}
}

export async function handleSettingsChange(
	configManager: CodeIndexConfigManager | undefined,
	stateManager: CodeIndexStateManager,
	context: vscode.ExtensionContext,
	workspacePath: string,
	_serviceFactory: CodeIndexServiceFactory | undefined,
	orchestrator: CodeIndexOrchestrator | undefined,
	_searchService: CodeIndexSearchService | undefined,
	cacheManager: CacheManager | undefined,
	stopIndexing: () => void,
	setServices: (services: ServiceSetters) => void,
): Promise<void> {
	if (!configManager) {
		return
	}

	const { requiresRestart } = await configManager.loadConfiguration()

	if (!configManager.isFeatureEnabled) {
		stopIndexing()
		stateManager.setSystemState("Standby", "Code indexing is disabled")
		return
	}

	if (requiresRestart && configManager.isFeatureConfigured) {
		await recreateOnSettingsChange(
			configManager,
			stateManager,
			context,
			workspacePath,
			orchestrator,
			cacheManager,
			setServices,
		)
	}
}
