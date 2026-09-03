import ignore from "ignore"
import fs from "fs/promises"
import path from "path"

import { readIgnoreFile } from "@utils/ignore"
import { fileExistsAtPath } from "@utils/io/fs"
import { getTelemetryService } from "@jabberwock/telemetry"
import { TelemetryEventName } from "@jabberwock/types"

import { CodeIndexConfigManager } from "@services/code-index/config/manager"
import { CodeIndexServiceFactory } from "@services/code-index/service-factory"
import { CodeIndexSearchService } from "@services/code-index/search-service"
import { CodeIndexOrchestrator } from "@services/code-index/orchestrator/orchestrator"
import { CacheManager } from "@services/code-index/cache-manager"
import type { IExtensionContextView } from "@features/foundation/host-context/context"
import type { CodeIndexStateManager } from "@services/code-index/state-manager"

export type RecreatedServices = {
	serviceFactory: CodeIndexServiceFactory
	orchestrator: CodeIndexOrchestrator
	searchService: CodeIndexSearchService
}

export async function recreateManagerServices(
	configManager: CodeIndexConfigManager,
	stateManager: CodeIndexStateManager,
	cacheManager: CacheManager,
	workspacePath: string,
	/** v4 B2 (L3/L11): structural context view replaces the type-only dynamic vscode import. */
	context: IExtensionContextView,
	onStopWatcher: () => void,
): Promise<RecreatedServices> {
	onStopWatcher()

	const serviceFactory = new CodeIndexServiceFactory(configManager, workspacePath, cacheManager)

	const ignoreInstance = ignore()

	if (!workspacePath) {
		stateManager.setSystemState("Standby", "")
		throw new Error("Workspace path is required")
	}

	const ignorePath = path.join(workspacePath, ".gitignore")
	try {
		if (await fileExistsAtPath(ignorePath)) {
			const content = await fs.readFile(ignorePath, "utf8")
			ignoreInstance.add(content)
			ignoreInstance.add(".gitignore")
		}
	} catch (error) {
		console.error("[jabberwock] Unexpected error loading .gitignore:", error)
		getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			location: "_recreateServices",
		})
	}

	const ignorePatterns = await readIgnoreFile(workspacePath)

	const { embedder, vectorStore, scanner, fileWatcher } = serviceFactory.createServices(
		context,
		cacheManager,
		ignoreInstance,
		ignorePatterns,
	)

	const validationResult = await serviceFactory.validateEmbedder(embedder)
	if (!validationResult.valid) {
		const errorMessage = validationResult.error || "Embedder configuration validation failed"
		stateManager.setSystemState("Error", errorMessage)
		throw new Error(errorMessage)
	}

	const orchestrator = new CodeIndexOrchestrator(
		configManager,
		stateManager,
		workspacePath,
		cacheManager,
		vectorStore,
		scanner,
		fileWatcher,
	)

	const searchService = new CodeIndexSearchService(configManager, stateManager, embedder, vectorStore)

	stateManager.setSystemState("Standby", "")

	return { serviceFactory, orchestrator, searchService }
}
