import type { CodebaseIndexConfig, CodebaseIndexProvider } from "@jabberwock/types"
import { getSettingsAccess } from "@utils/settings"
import { getVscodeContext } from "@features/foundation/vscode/context"
import { CodeIndexManager } from "@services/code-index/manager/manager"
import { log as backendLog } from "@features/foundation/capabilities/backend-logger"
import { getCodeIndexManager } from "@services/code-index/manager/manager.factory"
import { t } from "@i18n"

export const getGlobalState = async <K extends keyof import("@jabberwock/types").GlobalState>(
	key: K,
): Promise<import("@jabberwock/types").GlobalState[K]> =>
	getSettingsAccess().getValue(key) as Promise<import("@jabberwock/types").GlobalState[K]>

export const updateGlobalState = async <K extends keyof import("@jabberwock/types").GlobalState>(
	key: K,
	value: import("@jabberwock/types").GlobalState[K],
): Promise<void> => {
	await getSettingsAccess().setValue(key, value)
}

export async function saveCodeIndexSecrets(
	settings: Partial<CodebaseIndexConfig & CodebaseIndexProvider>,
): Promise<void> {
	const ctx = getVscodeContext()
	if (settings.codeIndexOpenAiKey !== undefined) {
		await ctx.storeSecret("codeIndexOpenAiKey", settings.codeIndexOpenAiKey)
	}
	if (settings.codeIndexQdrantApiKey !== undefined) {
		await ctx.storeSecret("codeIndexQdrantApiKey", settings.codeIndexQdrantApiKey)
	}
	if (settings.codebaseIndexOpenAiCompatibleApiKey !== undefined) {
		await ctx.storeSecret("codebaseIndexOpenAiCompatibleApiKey", settings.codebaseIndexOpenAiCompatibleApiKey)
	}
	if (settings.codebaseIndexGeminiApiKey !== undefined) {
		await ctx.storeSecret("codebaseIndexGeminiApiKey", settings.codebaseIndexGeminiApiKey)
	}
	if (settings.codebaseIndexMistralApiKey !== undefined) {
		await ctx.storeSecret("codebaseIndexMistralApiKey", settings.codebaseIndexMistralApiKey)
	}
	if (settings.codebaseIndexVercelAiGatewayApiKey !== undefined) {
		await ctx.storeSecret("codebaseIndexVercelAiGatewayApiKey", settings.codebaseIndexVercelAiGatewayApiKey)
	}
	if (settings.codebaseIndexOpenRouterApiKey !== undefined) {
		await ctx.storeSecret("codebaseIndexOpenRouterApiKey", settings.codebaseIndexOpenRouterApiKey)
	}
}

export function buildCodeIndexConfig(
	currentConfig: CodebaseIndexConfig,
	settings: Partial<CodebaseIndexConfig & CodebaseIndexProvider>,
): CodebaseIndexConfig {
	return {
		...currentConfig,
		codebaseIndexEnabled: settings.codebaseIndexEnabled,
		codebaseIndexQdrantUrl: settings.codebaseIndexQdrantUrl,
		codebaseIndexEmbedderProvider: settings.codebaseIndexEmbedderProvider,
		codebaseIndexEmbedderBaseUrl: settings.codebaseIndexEmbedderBaseUrl,
		codebaseIndexEmbedderModelId: settings.codebaseIndexEmbedderModelId,
		codebaseIndexEmbedderModelDimension: settings.codebaseIndexEmbedderModelDimension,
		codebaseIndexOpenAiCompatibleBaseUrl: settings.codebaseIndexOpenAiCompatibleBaseUrl,
		codebaseIndexBedrockRegion: settings.codebaseIndexBedrockRegion,
		codebaseIndexBedrockProfile: settings.codebaseIndexBedrockProfile,
		codebaseIndexSearchMaxResults: settings.codebaseIndexSearchMaxResults,
		codebaseIndexSearchMinScore: settings.codebaseIndexSearchMinScore,
		codebaseIndexOpenRouterSpecificProvider: settings.codebaseIndexOpenRouterSpecificProvider,
	}
}

export async function handleEmbedderChange(
	provider: import("@jabberwock/types").WebviewProvider,
	manager: CodeIndexManager,
): Promise<void> {
	try {
		await manager.handleSettingsChange()
	} catch (error) {
		backendLog.info(
			`Embedder validation failed after provider change: ${error instanceof Error ? error.message : String(error)}`,
		)
		await provider.postMessageToWebview({
			type: "indexingStatusUpdate",
			values: manager.getCurrentStatus(),
		})
	}
}

export async function initializeManagerIfReady(
	provider: import("@jabberwock/types").WebviewProvider,
	manager: CodeIndexManager,
): Promise<void> {
	if (!manager.isFeatureEnabled || !manager.isFeatureConfigured) {
		return
	}
	if (manager.isInitialized) {
		return
	}
	try {
		await manager.initialize(getVscodeContext())
		backendLog.info("Code index manager initialized after settings save")
	} catch (error) {
		backendLog.info(
			`Code index initialization failed: ${error instanceof Error ? error.message : String(error)}`,
		)
		await provider.postMessageToWebview({
			type: "indexingStatusUpdate",
			values: manager.getCurrentStatus(),
		})
	}
}

export async function handleManagerAfterSettingsSave(
	provider: import("@jabberwock/types").WebviewProvider,
	manager: CodeIndexManager,
	embedderProviderChanged: boolean,
): Promise<void> {
	if (embedderProviderChanged) {
		await handleEmbedderChange(provider, manager)
	} else {
		try {
			await manager.handleSettingsChange()
		} catch (error) {
			backendLog.info(
				`Settings change handling error: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	await new Promise((resolve) => setTimeout(resolve, 200))
	await initializeManagerIfReady(provider, manager)
}

export async function sendNoWorkspaceResponse(provider: import("@jabberwock/types").WebviewProvider): Promise<void> {
	await provider.postMessageToWebview({
		type: "indexingStatusUpdate",
		values: {
			systemStatus: "Error",
			message: t("embeddings:orchestrator.indexingRequiresWorkspace"),
			processedItems: 0,
			totalItems: 0,
			currentItemUnit: "items",
		},
	})
}

export async function startCodeIndexing(provider: import("@jabberwock/types").WebviewProvider): Promise<void> {
	const manager = getCodeIndexManager(getVscodeContext().extensionContext)
	if (!manager) {
		backendLog.info("Cannot start indexing: No workspace folder open")
		await sendNoWorkspaceResponse(provider)
		return
	}

	await manager.setWorkspaceEnabled(true)

	if (!manager.isFeatureEnabled || !manager.isFeatureConfigured) {
		return
	}

	await manager.initialize(getVscodeContext())

	const currentState = manager.state
	const shouldStartIndexing = currentState === "Standby" || currentState === "Error"

	if (!shouldStartIndexing) {
		return
	}

	manager.startIndexing()

	if (!manager.isInitialized) {
		await manager.initialize(getVscodeContext())
		if (manager.state === "Standby" || manager.state === "Error") {
			manager.startIndexing()
		}
	}
}

export async function toggleWorkspaceIndexing(
	provider: import("@jabberwock/types").WebviewProvider,
	bool: boolean,
): Promise<void> {
	const manager = getCodeIndexManager(getVscodeContext().extensionContext)
	if (!manager) {
		backendLog.info("Cannot toggle workspace indexing: No workspace folder open")
		return
	}

	const enabled = bool ?? false
	await manager.setWorkspaceEnabled(enabled)

	if (enabled && manager.isFeatureEnabled && manager.isFeatureConfigured) {
		await manager.initialize(getVscodeContext())
		manager.startIndexing()
	} else if (!enabled) {
		manager.stopIndexing()
	}

	provider.postMessageToWebview({
		type: "indexingStatusUpdate",
		values: manager.getCurrentStatus(),
	})
}

export async function syncManagersAfterAutoEnable(
	allManagers: CodeIndexManager[],
	priorStates: Map<CodeIndexManager, boolean>,
): Promise<void> {
	for (const m of allManagers) {
		const wasEnabled = priorStates.get(m)
		const isNowEnabled = m.isWorkspaceEnabled

		if (wasEnabled && !isNowEnabled) {
			m.stopIndexing()
			continue
		}

		if (!wasEnabled && isNowEnabled && m.isFeatureEnabled && m.isFeatureConfigured) {
			await m.initialize(getVscodeContext())
			m.startIndexing()
		}
	}
}
