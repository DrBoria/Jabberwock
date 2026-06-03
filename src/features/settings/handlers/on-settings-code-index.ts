import { IntentType, CodebaseIndexConfig, CodebaseIndexProvider } from "@jabberwock/types"
import type { IntentBus } from "../../intents/bus"
import { getSettingsAccess } from "@utils/settings-access"
import { getVscodeContext } from "../../foundation/vscode/context"
import { CodeIndexManager, getCodeIndexManager, getAllCodeIndexManagers } from "../../../services/code-index/manager"
import { t } from "../../../i18n"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { EventBridge } from "@features/foundation/webview/EventBridge"

/** Helper: concise get/update of global state via contextProxy API */
const getGlobalState = async <K extends keyof import("@jabberwock/types").GlobalState>(
	key: K,
): Promise<import("@jabberwock/types").GlobalState[K]> =>
	getSettingsAccess().getValue(key) as Promise<import("@jabberwock/types").GlobalState[K]>

const updateGlobalState = async <K extends keyof import("@jabberwock/types").GlobalState>(
	key: K,
	value: import("@jabberwock/types").GlobalState[K],
): Promise<void> => {
	await getSettingsAccess().setValue(key, value)
}

/**
 * Register all code index settings intent handlers.
 */
export function registerOnSettingsCodeIndex(bus: IntentBus): void {
	// ── saveCodeIndexSettingsAtomic ────────────────────────────────────
	bus.register(IntentType.SettingsCodeIndexSave, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as {
			codeIndexSettings: (Partial<CodebaseIndexConfig> & Partial<CodebaseIndexProvider>) | undefined
		}
		if (!payload.codeIndexSettings) return

		const settings = payload.codeIndexSettings

		try {
			// Check if embedder provider has changed
			const currentConfig = (await getGlobalState("codebaseIndexConfig")) || ({} as CodebaseIndexConfig)
			const embedderProviderChanged =
				currentConfig?.codebaseIndexEmbedderProvider !== settings.codebaseIndexEmbedderProvider

			// Save global state settings atomically
			const globalStateConfig: CodebaseIndexConfig = {
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
			await updateGlobalState(
				"codebaseIndexConfig",
				globalStateConfig as import("@jabberwock/types").GlobalState["codebaseIndexConfig"],
			)

			// Save secrets directly using context proxy
			if (settings.codeIndexOpenAiKey !== undefined) {
				await getVscodeContext().storeSecret("codeIndexOpenAiKey", settings.codeIndexOpenAiKey as string)
			}
			if (settings.codeIndexQdrantApiKey !== undefined) {
				await getVscodeContext().storeSecret("codeIndexQdrantApiKey", settings.codeIndexQdrantApiKey as string)
			}
			if (settings.codebaseIndexOpenAiCompatibleApiKey !== undefined) {
				await getVscodeContext().storeSecret(
					"codebaseIndexOpenAiCompatibleApiKey",
					settings.codebaseIndexOpenAiCompatibleApiKey as string,
				)
			}
			if (settings.codebaseIndexGeminiApiKey !== undefined) {
				await getVscodeContext().storeSecret(
					"codebaseIndexGeminiApiKey",
					settings.codebaseIndexGeminiApiKey as string,
				)
			}
			if (settings.codebaseIndexMistralApiKey !== undefined) {
				await getVscodeContext().storeSecret(
					"codebaseIndexMistralApiKey",
					settings.codebaseIndexMistralApiKey as string,
				)
			}
			if (settings.codebaseIndexVercelAiGatewayApiKey !== undefined) {
				await getVscodeContext().storeSecret(
					"codebaseIndexVercelAiGatewayApiKey",
					settings.codebaseIndexVercelAiGatewayApiKey as string,
				)
			}
			if (settings.codebaseIndexOpenRouterApiKey !== undefined) {
				await getVscodeContext().storeSecret(
					"codebaseIndexOpenRouterApiKey",
					settings.codebaseIndexOpenRouterApiKey as string,
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
			const currentCodeIndexManager = getCodeIndexManager(getVscodeContext().extensionContext)
			if (currentCodeIndexManager) {
				// If embedder provider changed, perform proactive validation
				if (embedderProviderChanged) {
					try {
						await currentCodeIndexManager.handleSettingsChange()
					} catch (error) {
						EventBridge.outputChannel?.appendLine(
							`Embedder validation failed after provider change: ${error instanceof Error ? error.message : String(error)}`,
						)
						await provider.postMessageToWebview({
							type: "indexingStatusUpdate",
							values: currentCodeIndexManager.getCurrentStatus(),
						})
						return
					}
				} else {
					try {
						await currentCodeIndexManager.handleSettingsChange()
					} catch (error) {
						EventBridge.outputChannel?.appendLine(
							`Settings change handling error: ${error instanceof Error ? error.message : String(error)}`,
						)
					}
				}

				await new Promise((resolve) => setTimeout(resolve, 200))

				if (currentCodeIndexManager.isFeatureEnabled && currentCodeIndexManager.isFeatureConfigured) {
					if (!currentCodeIndexManager.isInitialized) {
						try {
							await currentCodeIndexManager.initialize(getVscodeContext())
							EventBridge.outputChannel?.appendLine(`Code index manager initialized after settings save`)
						} catch (error) {
							EventBridge.outputChannel?.appendLine(
								`Code index initialization failed: ${error instanceof Error ? error.message : String(error)}`,
							)
							await provider.postMessageToWebview({
								type: "indexingStatusUpdate",
								values: currentCodeIndexManager.getCurrentStatus(),
							})
						}
					}
				}
			} else {
				EventBridge.outputChannel?.appendLine("Cannot save code index settings: No workspace folder open")
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
			EventBridge.outputChannel?.appendLine(`Error saving code index settings: ${errMsg}`)
			await provider.postMessageToWebview({
				type: "codeIndexSettingsSaved",
				success: false,
				error: errMsg,
			})
		}
	})

	// ── requestIndexingStatus ─────────────────────────────────────────
	bus.register(IntentType.SettingsCodeIndexStatus, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const manager = getCodeIndexManager(getVscodeContext().extensionContext)
		if (!manager) {
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

		const status = manager.getCurrentStatus()
		provider.postMessageToWebview({
			type: "indexingStatusUpdate",
			values: status,
		})
	})

	// ── requestCodeIndexSecretStatus ──────────────────────────────────
	bus.register(IntentType.SettingsCodeIndexSecretStatus, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

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
	})

	// ── startIndexing ─────────────────────────────────────────────────
	bus.register(IntentType.SettingsCodeIndexStart, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const manager = getCodeIndexManager(getVscodeContext().extensionContext)
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
				EventBridge.outputChannel?.appendLine("Cannot start indexing: No workspace folder open")
				return
			}

			await manager.setWorkspaceEnabled(true)

			if (manager.isFeatureEnabled && manager.isFeatureConfigured) {
				await manager.initialize(getVscodeContext())

				const currentState = manager.state
				if (currentState === "Standby" || currentState === "Error") {
					manager.startIndexing()

					if (!manager.isInitialized) {
						await manager.initialize(getVscodeContext())
						if (manager.state === "Standby" || manager.state === "Error") {
							manager.startIndexing()
						}
					}
				}
			}
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error starting indexing: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	})

	// ── stopIndexing ──────────────────────────────────────────────────
	bus.register(IntentType.SettingsCodeIndexStop, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const manager = getCodeIndexManager(getVscodeContext().extensionContext)
			if (!manager) {
				EventBridge.outputChannel?.appendLine("Cannot stop indexing: No workspace folder open")
				return
			}
			manager.stopIndexing()
			provider.postMessageToWebview({
				type: "indexingStatusUpdate",
				values: manager.getCurrentStatus(),
			})
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error stopping indexing: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	})

	// ── toggleWorkspaceIndexing ───────────────────────────────────────
	bus.register(IntentType.SettingsCodeIndexWorkspaceToggle, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { bool: boolean }

		try {
			const manager = getCodeIndexManager(getVscodeContext().extensionContext)
			if (!manager) {
				EventBridge.outputChannel?.appendLine("Cannot toggle workspace indexing: No workspace folder open")
				return
			}
			const enabled = payload.bool ?? false
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
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error toggling workspace indexing: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	})

	// ── setAutoEnableDefault ──────────────────────────────────────────
	bus.register(IntentType.SettingsCodeIndexAutoEnable, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { bool: boolean }

		try {
			const manager = getCodeIndexManager(getVscodeContext().extensionContext)
			if (!manager) {
				EventBridge.outputChannel?.appendLine("Cannot set auto-enable default: No workspace folder open")
				return
			}
			const allManagers = getAllCodeIndexManagers()
			const priorStates = new Map(allManagers.map((m) => [m, m.isWorkspaceEnabled]))
			await manager.setAutoEnableDefault(payload.bool ?? true)
			for (const m of allManagers) {
				const wasEnabled = priorStates.get(m)!
				const isNowEnabled = m.isWorkspaceEnabled
				if (wasEnabled && !isNowEnabled) {
					m.stopIndexing()
				} else if (!wasEnabled && isNowEnabled && m.isFeatureEnabled && m.isFeatureConfigured) {
					await m.initialize(getVscodeContext())
					m.startIndexing()
				}
			}
			provider.postMessageToWebview({
				type: "indexingStatusUpdate",
				values: manager.getCurrentStatus(),
			})
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error setting auto-enable default: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	})

	// ── clearIndexData ────────────────────────────────────────────────
	bus.register(IntentType.SettingsCodeIndexClear, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const manager = getCodeIndexManager(getVscodeContext().extensionContext)
			if (!manager) {
				EventBridge.outputChannel?.appendLine("Cannot clear index data: No workspace folder open")
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
			EventBridge.outputChannel?.appendLine(
				`Error clearing index data: ${error instanceof Error ? error.message : String(error)}`,
			)
			provider.postMessageToWebview({
				type: "indexCleared",
				values: {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				},
			})
		}
	})
}
