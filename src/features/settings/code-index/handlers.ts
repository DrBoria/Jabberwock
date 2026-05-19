import type { EventBridge } from "../../../core/webview/EventBridge"
import type { WebviewMessage, GlobalState } from "@jabberwock/types"
import { CodeIndexManager, getAllCodeIndexManagers } from "../../../services/code-index/manager"
import { t } from "../../../i18n"
import { getCodeIndexState } from "./store"

import { postStateToWebview } from "../../foundation/window-manager/store"
export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

// Helper: concise get/update of global state via contextProxy API
const getGlobalState = <K extends keyof GlobalState>(provider: EventBridge, key: K) =>
	provider.contextProxy.getValue(key) as Promise<GlobalState[K]>

const updateGlobalState = async <K extends keyof GlobalState>(provider: EventBridge, key: K, value: GlobalState[K]) =>
	await provider.contextProxy.setValue(key, value)

export const handlerMap: Record<string, HandlerFn> = {
	saveCodeIndexSettingsAtomic: async (provider, message) => {
		if (!message.codeIndexSettings) {
			return
		}

		const settings = message.codeIndexSettings!

		try {
			// Check if embedder provider has changed
			const currentConfig = (await getGlobalState(provider, "codebaseIndexConfig")) || {}
			const embedderProviderChanged =
				currentConfig?.codebaseIndexEmbedderProvider !== settings.codebaseIndexEmbedderProvider

			// Save global state settings atomically
			const globalStateConfig = {
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

			// Save global state first
			await updateGlobalState(provider, "codebaseIndexConfig", globalStateConfig)

			// Save secrets directly using context proxy
			if (settings.codeIndexOpenAiKey !== undefined) {
				await provider.contextProxy.storeSecret("codeIndexOpenAiKey", settings.codeIndexOpenAiKey)
			}
			if (settings.codeIndexQdrantApiKey !== undefined) {
				await provider.contextProxy.storeSecret("codeIndexQdrantApiKey", settings.codeIndexQdrantApiKey)
			}
			if (settings.codebaseIndexOpenAiCompatibleApiKey !== undefined) {
				await provider.contextProxy.storeSecret(
					"codebaseIndexOpenAiCompatibleApiKey",
					settings.codebaseIndexOpenAiCompatibleApiKey,
				)
			}
			if (settings.codebaseIndexGeminiApiKey !== undefined) {
				await provider.contextProxy.storeSecret("codebaseIndexGeminiApiKey", settings.codebaseIndexGeminiApiKey)
			}
			if (settings.codebaseIndexMistralApiKey !== undefined) {
				await provider.contextProxy.storeSecret(
					"codebaseIndexMistralApiKey",
					settings.codebaseIndexMistralApiKey,
				)
			}
			if (settings.codebaseIndexVercelAiGatewayApiKey !== undefined) {
				await provider.contextProxy.storeSecret(
					"codebaseIndexVercelAiGatewayApiKey",
					settings.codebaseIndexVercelAiGatewayApiKey,
				)
			}
			if (settings.codebaseIndexOpenRouterApiKey !== undefined) {
				await provider.contextProxy.storeSecret(
					"codebaseIndexOpenRouterApiKey",
					settings.codebaseIndexOpenRouterApiKey,
				)
			}

			// Send success response first - settings are saved regardless of validation
			await provider.postMessageToWebview({
				type: "codeIndexSettingsSaved",
				success: true,
				settings: globalStateConfig,
			})

			// Update webview state
			await postStateToWebview(provider)

			// Then handle validation and initialization for the current workspace
			const currentCodeIndexManager = getCodeIndexState(provider).codeIndexManager
			if (currentCodeIndexManager) {
				// If embedder provider changed, perform proactive validation
				if (embedderProviderChanged) {
					try {
						// Force handleSettingsChange which will trigger validation
						await currentCodeIndexManager.handleSettingsChange()
					} catch (error) {
						// Validation failed - the error state is already set by handleSettingsChange
						provider.log(
							`Embedder validation failed after provider change: ${error instanceof Error ? error.message : String(error)}`,
						)
						// Send validation error to webview
						await provider.postMessageToWebview({
							type: "indexingStatusUpdate",
							values: currentCodeIndexManager.getCurrentStatus(),
						})
						// Exit early - don't try to start indexing with invalid configuration
						return
					}
				} else {
					// No provider change, just handle settings normally
					try {
						await currentCodeIndexManager.handleSettingsChange()
					} catch (error) {
						// Log but don't fail - settings are saved
						provider.log(
							`Settings change handling error: ${error instanceof Error ? error.message : String(error)}`,
						)
					}
				}

				// Wait a bit more to ensure everything is ready
				await new Promise((resolve) => setTimeout(resolve, 200))

				// Auto-start indexing if now enabled and configured
				if (currentCodeIndexManager.isFeatureEnabled && currentCodeIndexManager.isFeatureConfigured) {
					if (!currentCodeIndexManager.isInitialized) {
						try {
							await currentCodeIndexManager.initialize(provider.contextProxy)
							provider.log(`Code index manager initialized after settings save`)
						} catch (error) {
							provider.log(
								`Code index initialization failed: ${error instanceof Error ? error.message : String(error)}`,
							)
							// Send error status to webview
							await provider.postMessageToWebview({
								type: "indexingStatusUpdate",
								values: currentCodeIndexManager.getCurrentStatus(),
							})
						}
					}
				}
			} else {
				// No workspace open - send error status
				provider.log("Cannot save code index settings: No workspace folder open")
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
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : String(error)
			provider.log(`Error saving code index settings: ${errMsg}`)
			await provider.postMessageToWebview({
				type: "codeIndexSettingsSaved",
				success: false,
				error: errMsg,
			})
		}
	},

	requestIndexingStatus: async (provider, message) => {
		const manager = getCodeIndexState(provider).codeIndexManager
		if (!manager) {
			// No workspace open - send error status
			provider.postMessageToWebview({
				type: "indexingStatusUpdate",
				values: {
					systemStatus: "Error",
					message: t("embeddings:orchestrator.indexingRequiresWorkspace"),
					processedItems: 0,
					totalItems: 0,
					currentItemUnit: "items",
					workerspacePath: undefined,
				},
			})
			return
		}

		const status = manager
			? manager.getCurrentStatus()
			: {
					systemStatus: "Standby",
					message: "No workspace folder open",
					processedItems: 0,
					totalItems: 0,
					currentItemUnit: "items",
					workspacePath: undefined,
				}

		provider.postMessageToWebview({
			type: "indexingStatusUpdate",
			values: status,
		})
	},

	requestCodeIndexSecretStatus: async (provider, message) => {
		// Check if secrets are set using the VSCode context directly for async access
		const hasOpenAiKey = !!(await provider.context.secrets.get("codeIndexOpenAiKey"))
		const hasQdrantApiKey = !!(await provider.context.secrets.get("codeIndexQdrantApiKey"))
		const hasOpenAiCompatibleApiKey = !!(await provider.context.secrets.get("codebaseIndexOpenAiCompatibleApiKey"))
		const hasGeminiApiKey = !!(await provider.context.secrets.get("codebaseIndexGeminiApiKey"))
		const hasMistralApiKey = !!(await provider.context.secrets.get("codebaseIndexMistralApiKey"))
		const hasVercelAiGatewayApiKey = !!(await provider.context.secrets.get("codebaseIndexVercelAiGatewayApiKey"))
		const hasOpenRouterApiKey = !!(await provider.context.secrets.get("codebaseIndexOpenRouterApiKey"))

		provider.postMessageToWebview({
			type: "codeIndexSecretStatus",
			values: {
				hasOpenAiKey,
				hasQdrantApiKey,
				hasOpenAiCompatibleApiKey,
				hasGeminiApiKey,
				hasMistralApiKey,
				hasVercelAiGatewayApiKey,
				hasOpenRouterApiKey,
			},
		})
	},

	startIndexing: async (provider, message) => {
		try {
			const manager = getCodeIndexState(provider).codeIndexManager
			if (!manager) {
				provider.postMessageToWebview({
					type: "indexingStatusUpdate",
					values: {
						systemStatus: "Error",
						message: t("embeddings:orchestrator.indexingRequiresWorkspace"),
						processedItems: 0,
						totalItems: 0,
						currentItemUnit: "items",
					},
				})
				provider.log("Cannot start indexing: No workspace folder open")
				return
			}

			// "Start Indexing" implicitly enables the workspace
			await manager.setWorkspaceEnabled(true)

			if (manager.isFeatureEnabled && manager.isFeatureConfigured) {
				await manager.initialize(provider.contextProxy)

				const currentState = manager.state
				if (currentState === "Standby" || currentState === "Error") {
					manager.startIndexing()

					if (!manager.isInitialized) {
						await manager.initialize(provider.contextProxy)
						if (manager.state === "Standby" || manager.state === "Error") {
							manager.startIndexing()
						}
					}
				}
			}
		} catch (error) {
			provider.log(`Error starting indexing: ${error instanceof Error ? error.message : String(error)}`)
		}
	},

	stopIndexing: async (provider, message) => {
		try {
			const manager = getCodeIndexState(provider).codeIndexManager
			if (!manager) {
				provider.log("Cannot stop indexing: No workspace folder open")
				return
			}
			manager.stopIndexing()
			provider.postMessageToWebview({
				type: "indexingStatusUpdate",
				values: manager.getCurrentStatus(),
			})
		} catch (error) {
			provider.log(`Error stopping indexing: ${error instanceof Error ? error.message : String(error)}`)
		}
	},

	toggleWorkspaceIndexing: async (provider, message) => {
		try {
			const manager = getCodeIndexState(provider).codeIndexManager
			if (!manager) {
				provider.log("Cannot toggle workspace indexing: No workspace folder open")
				return
			}
			const enabled = message.bool ?? false
			await manager.setWorkspaceEnabled(enabled)
			if (enabled && manager.isFeatureEnabled && manager.isFeatureConfigured) {
				await manager.initialize(provider.contextProxy)
				manager.startIndexing()
			} else if (!enabled) {
				manager.stopIndexing()
			}
			provider.postMessageToWebview({
				type: "indexingStatusUpdate",
				values: manager.getCurrentStatus(),
			})
		} catch (error) {
			provider.log(`Error toggling workspace indexing: ${error instanceof Error ? error.message : String(error)}`)
		}
	},

	setAutoEnableDefault: async (provider, message) => {
		try {
			const manager = getCodeIndexState(provider).codeIndexManager
			if (!manager) {
				provider.log("Cannot set auto-enable default: No workspace folder open")
				return
			}
			// Capture prior state for every manager before persisting the global change
			const allManagers = getAllCodeIndexManagers()
			const priorStates = new Map(allManagers.map((m) => [m, m.isWorkspaceEnabled]))
			await manager.setAutoEnableDefault(message.bool ?? true)
			// Apply stop/start to every affected manager
			for (const m of allManagers) {
				const wasEnabled = priorStates.get(m)!
				const isNowEnabled = m.isWorkspaceEnabled
				if (wasEnabled && !isNowEnabled) {
					m.stopIndexing()
				} else if (!wasEnabled && isNowEnabled && m.isFeatureEnabled && m.isFeatureConfigured) {
					await m.initialize(provider.contextProxy)
					m.startIndexing()
				}
			}
			provider.postMessageToWebview({
				type: "indexingStatusUpdate",
				values: manager.getCurrentStatus(),
			})
		} catch (error) {
			provider.log(`Error setting auto-enable default: ${error instanceof Error ? error.message : String(error)}`)
		}
	},

	clearIndexData: async (provider, message) => {
		try {
			const manager = getCodeIndexState(provider).codeIndexManager
			if (!manager) {
				provider.log("Cannot clear index data: No workspace folder open")
				provider.postMessageToWebview({
					type: "indexCleared",
					values: {
						success: false,
						error: t("embeddings:orchestrator.indexingRequiresWorkspace"),
					},
				})
				return
			}
			await manager.clearIndexData()
			provider.postMessageToWebview({ type: "indexCleared", values: { success: true } })
		} catch (error) {
			provider.log(`Error clearing index data: ${error instanceof Error ? error.message : String(error)}`)
			provider.postMessageToWebview({
				type: "indexCleared",
				values: {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				},
			})
		}
	},
}
