import { IntentType, type ModelRecord } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { getOpenAiModels } from "@api/providers/openai/models"
import { getOllamaModels } from "@api/providers/fetchers/providers/ollama"
import { getLMStudioModels } from "@api/providers/fetchers/providers/lmstudio"
import { getRooModels } from "@api/providers/fetchers/providers/jabberwock"
import { getModels, flushModels } from "@api/providers/fetchers/modelCache"
import { getHostModels } from "@features/foundation/capabilities/registry"
import { toRouterName } from "@shared/api"
import type { GetModelsOptions } from "@shared/api"
import { getCloudService, hasCloudService } from "@jabberwock/cloud"
import { log as backendLog } from "@features/foundation/capabilities/backend-logger"

/**
 * Register all models settings intent handlers.
 */

export function registerOnSettingsModels(bus: IntentBus): void {
	// ── requestRouterModels ───────────────────────────────────────────
	bus.register(IntentType.SettingsModelsRouterRequest, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as {
			values?: { provider?: string; refresh?: boolean; litellmApiKey?: string; litellmBaseUrl?: string }
		}

		try {
			const safeGetModels = async (options: { provider: string; refresh?: boolean }): Promise<ModelRecord> => {
				try {
					const routerName = toRouterName(options.provider)
					const result = await getModels({
						provider: routerName,
						refresh: options.refresh,
					} as GetModelsOptions)
					return result
				} catch (error) {
					backendLog.info(
						`Error fetching router models: ${error instanceof Error ? error.message : String(error)}`,
					)
					return {}
				}
			}

			const modelFetchPromises: { key: string; options: Parameters<typeof safeGetModels>[0] }[] = [
				{
					key: "routerModels",
					options: {
						provider: payload.values?.provider ?? "openrouter",
						refresh: payload.values?.refresh,
					},
				},
			]

			const results = await Promise.all(
				modelFetchPromises.map(async ({ key, options }) => {
					const models = await safeGetModels(options)
					return { key, models }
				}),
			)

			const aggregatedModels: Record<string, ModelRecord> = {}
			results.forEach((result) => {
				aggregatedModels[result.key] = result.models
			})

			await provider.postMessageToWebview({
				type: "routerModels",
				models: aggregatedModels.routerModels,
			})
		} catch (error) {
			backendLog.info(`Error in requestRouterModels: ${error instanceof Error ? error.message : String(error)}`)
		}
	})

	// ── requestOpenAiModels ───────────────────────────────────────────
	bus.register(IntentType.SettingsModelsOpenaiRequest, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as {
			values: { baseUrl: string; apiKey: string; openAiHeaders?: Record<string, string> }
		}

		try {
			const models = await getOpenAiModels(
				payload.values.baseUrl,
				payload.values.apiKey,
				payload.values.openAiHeaders,
			)
			await provider.postMessageToWebview({
				type: "openAiModels",
				models,
				baseUrl: payload.values.baseUrl,
			})
		} catch (error) {
			backendLog.info(`Error fetching OpenAI models: ${error instanceof Error ? error.message : String(error)}`)
			await provider.postMessageToWebview({
				type: "openAiModels",
				models: [],
				baseUrl: payload.values.baseUrl,
				error: error instanceof Error ? error.message : String(error),
			})
		}
	})

	// ── requestOllamaModels ───────────────────────────────────────────
	bus.register(IntentType.SettingsModelsOllamaRequest, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const models = await getOllamaModels()
			await provider.postMessageToWebview({ type: "ollamaModels", models })
		} catch (error) {
			backendLog.info(`Error fetching Ollama models: ${error instanceof Error ? error.message : String(error)}`)
			await provider.postMessageToWebview({ type: "ollamaModels", models: [] })
		}
	})

	// ── requestLmStudioModels ─────────────────────────────────────────
	bus.register(IntentType.SettingsModelsLmstudioRequest, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const models = await getLMStudioModels()
			await provider.postMessageToWebview({ type: "lmStudioModels", models })
		} catch (error) {
			backendLog.info(
				`Error fetching LM Studio models: ${error instanceof Error ? error.message : String(error)}`,
			)
			await provider.postMessageToWebview({ type: "lmStudioModels", models: [] })
		}
	})

	// ── requestRooModels ──────────────────────────────────────────────
	bus.register(IntentType.SettingsModelsRooRequest, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const models = await getRooModels("", "")
			await provider.postMessageToWebview({ type: "rooModels", models })
		} catch (error) {
			backendLog.info(`Error fetching Roo models: ${error instanceof Error ? error.message : String(error)}`)
			await provider.postMessageToWebview({ type: "rooModels", models: [] })
		}
	})

	// ── requestRooCreditBalance ───────────────────────────────────────
	bus.register(IntentType.SettingsModelsRooCreditBalance, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { requestId?: string }

		try {
			if (!hasCloudService()) {
				throw new Error("Cloud service not available")
			}

			const cloudService = getCloudService()
			if (!cloudService?.cloudAPI) {
				throw new Error("Cloud API not available")
			}

			const balance = await cloudService.cloudAPI.creditBalance()
			await provider.postMessageToWebview({
				type: "rooCreditBalance",
				requestId: payload.requestId,
				values: { balance },
			})
		} catch (error) {
			backendLog.info(
				`Error fetching Roo credit balance: ${error instanceof Error ? error.message : String(error)}`,
			)
			await provider.postMessageToWebview({
				type: "rooCreditBalance",
				requestId: payload.requestId,
				values: { error: error instanceof Error ? error.message : String(error) },
			})
		}
	})

	// ── requestVsCodeLmModels ─────────────────────────────────────────
	bus.register(IntentType.SettingsModelsVscodeLmRequest, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			// D4g-2 (batch 3): host model listing via the capability slot (locked orchestrator
			// decision Q1 option a) — the vscode connector backs this with getVsCodeLmModels;
			// server mode has no host models, so the slot is absent and we send an empty list.
			const hostModels = getHostModels()
			const models = hostModels ? await hostModels("vscode-lm") : []
			await provider.postMessageToWebview({ type: "vsCodeLmModels", models })
		} catch (error) {
			backendLog.info(
				`Error fetching VS Code LM models: ${error instanceof Error ? error.message : String(error)}`,
			)
			await provider.postMessageToWebview({ type: "vsCodeLmModels", models: [] })
		}
	})

	// ── flushRouterModels ─────────────────────────────────────────────
	bus.register(IntentType.SettingsModelsRouterFlush, async (intent) => {
		const payload = intent.payload as { text: string }
		const routerName = toRouterName(payload.text)
		await flushModels({ provider: routerName } as GetModelsOptions, true)
	})
}
