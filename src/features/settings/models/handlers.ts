import type { EventBridge } from "../../../core/webview/EventBridge"
import type { WebviewMessage, ModelRecord } from "@jabberwock/types"
import { type RouterName, toRouterName } from "../../../shared/api"
import { type GetModelsOptions } from "../../../shared/api"
import { getModels, flushModels } from "../../../api/providers/fetchers/modelCache"
import { getOpenAiModels } from "../../../api/providers/openai"
import { getVsCodeLmModels } from "../../../api/providers/vscode-lm"
import { CloudService, getCloudService, hasCloudService } from "@jabberwock/cloud"
import { getMstState } from "../../foundation/mst/store"

export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

export const handlerMap: Record<string, HandlerFn> = {
	requestRouterModels: async (provider, message) => {
		const state = await provider.getState()
		const apiConfiguration = (state.apiConfiguration || {}) as Record<string, unknown>

		const requestedProvider = message?.values?.provider as string | undefined
		const providerFilter = requestedProvider ? toRouterName(requestedProvider) : undefined
		const shouldRefresh = message?.values?.refresh === true

		const routerModels: Record<RouterName, ModelRecord> = providerFilter
			? ({} as Record<RouterName, ModelRecord>)
			: {
					openrouter: {},
					"vercel-ai-gateway": {},
					litellm: {},
					requesty: {},
					unbound: {},
					ollama: {},
					lmstudio: {},
					jabberwock: {},
				}

		const safeGetModels = async (options: GetModelsOptions): Promise<ModelRecord> => {
			try {
				return await getModels(options)
			} catch (error) {
				console.error(
					`Failed to fetch models in webviewMessageHandler requestRouterModels for ${options.provider}:`,
					error,
				)
				throw error
			}
		}

		const candidates: { key: RouterName; options: GetModelsOptions }[] = [
			{ key: "openrouter", options: { provider: "openrouter" } },
			{
				key: "requesty",
				options: {
					provider: "requesty",
					apiKey: apiConfiguration.requestyApiKey as string | undefined,
					baseUrl: apiConfiguration.requestyBaseUrl as string | undefined,
				},
			},
			{
				key: "unbound",
				options: {
					provider: "unbound",
					apiKey: apiConfiguration.unboundApiKey as string | undefined,
				},
			},
			{ key: "vercel-ai-gateway", options: { provider: "vercel-ai-gateway" } },
			{
				key: "jabberwock",
				options: {
					provider: "jabberwock",
					baseUrl: process.env.JABBERWOCK_CODE_PROVIDER_URL ?? "https://api.jabberwock.com/proxy",
					apiKey: hasCloudService() ? getCloudService().authService?.getSessionToken() : undefined,
				},
			},
		]

		const litellmApiKey = (apiConfiguration.litellmApiKey || message?.values?.litellmApiKey) as string | undefined
		const litellmBaseUrl = (apiConfiguration.litellmBaseUrl || message?.values?.litellmBaseUrl) as
			| string
			| undefined

		if (litellmApiKey && litellmBaseUrl) {
			if (message?.values?.litellmApiKey || message?.values?.litellmBaseUrl) {
				await flushModels({ provider: "litellm", apiKey: litellmApiKey, baseUrl: litellmBaseUrl }, true)
			}

			candidates.push({
				key: "litellm",
				options: { provider: "litellm", apiKey: litellmApiKey, baseUrl: litellmBaseUrl },
			})
		}

		const modelFetchPromises = providerFilter ? candidates.filter(({ key }) => key === providerFilter) : candidates

		if (shouldRefresh && providerFilter && modelFetchPromises.length > 0) {
			const targetCandidate = modelFetchPromises[0]
			await flushModels(targetCandidate.options, true)
		}

		const results = await Promise.allSettled(
			modelFetchPromises.map(async ({ key, options }) => {
				const models = await safeGetModels(options)
				return { key, models }
			}),
		)

		results.forEach((result, index) => {
			const routerName = modelFetchPromises[index].key

			if (result.status === "fulfilled") {
				routerModels[routerName] = result.value.models
			} else {
				const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason)
				console.error(`Error fetching models for ${routerName}:`, result.reason)

				routerModels[routerName] = {}
				provider.postMessageToWebview({
					type: "singleRouterModelFetchResponse",
					success: false,
					error: errorMessage,
					values: { provider: routerName },
				})
			}
		})
		provider.postMessageToWebview({
			type: "routerModels",
			routerModels,
			values: providerFilter ? { provider: requestedProvider } : undefined,
		})
		getMstState(provider).routerModelsStore?.setRouterModels(routerModels)
	},

	requestOpenAiModels: async (provider, message) => {
		const values = message?.values as Record<string, unknown> | undefined
		if (values?.baseUrl && values?.apiKey) {
			const openAiModels = await getOpenAiModels(
				values?.baseUrl as string,
				values?.apiKey as string,
				values?.openAiHeaders as Record<string, string> | undefined,
			)

			provider.postMessageToWebview({ type: "openAiModels", openAiModels })
			getMstState(provider).routerModelsStore?.setOpenAiModels(openAiModels)
		}
	},

	requestOllamaModels: async (provider, _message) => {
		const state = await provider.getState()
		const ollamaApiConfig = (state.apiConfiguration || {}) as Record<string, unknown>
		try {
			const ollamaOptions = {
				provider: "ollama" as const,
				baseUrl: ollamaApiConfig.ollamaBaseUrl as string | undefined,
				apiKey: ollamaApiConfig?.ollamaApiKey as string | undefined,
			}
			await flushModels(ollamaOptions, true)

			const ollamaModels = await getModels(ollamaOptions)

			if (Object.keys(ollamaModels).length > 0) {
				provider.postMessageToWebview({ type: "ollamaModels", ollamaModels })
				getMstState(provider).routerModelsStore?.setOllamaModels(ollamaModels)
			}
		} catch (error) {
			console.debug("Ollama models fetch failed:", error)
		}
	},

	requestLmStudioModels: async (provider, _message) => {
		const state = await provider.getState()
		const lmStudioApiConfig = (state.apiConfiguration || {}) as Record<string, unknown>
		try {
			const lmStudioOptions = {
				provider: "lmstudio" as const,
				baseUrl: lmStudioApiConfig.lmStudioBaseUrl as string | undefined,
			}
			await flushModels(lmStudioOptions, true)

			const lmStudioModels = await getModels(lmStudioOptions)

			if (Object.keys(lmStudioModels).length > 0) {
				provider.postMessageToWebview({
					type: "lmStudioModels",
					lmStudioModels,
				})
				getMstState(provider).routerModelsStore?.setLmStudioModels(lmStudioModels)
			}
		} catch (error) {
			console.debug("LM Studio models fetch failed:", error)
		}
	},

	requestRooModels: async (provider, _message) => {
		try {
			const rooOptions = {
				provider: "jabberwock" as const,
				baseUrl: process.env.JABBERWOCK_CODE_PROVIDER_URL ?? "https://api.jabberwock.com/proxy",
				apiKey: hasCloudService() ? getCloudService().authService?.getSessionToken() : undefined,
			}
			await flushModels(rooOptions, true)

			const rooModels = await getModels(rooOptions)

			provider.postMessageToWebview({
				type: "singleRouterModelFetchResponse",
				success: true,
				values: { provider: "jabberwock", models: rooModels },
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			provider.postMessageToWebview({
				type: "singleRouterModelFetchResponse",
				success: false,
				error: errorMessage,
				values: { provider: "jabberwock" },
			})
		}
	},

	requestRooCreditBalance: async (provider, message) => {
		const requestId = message.requestId
		try {
			const cloudService = getCloudService()
			if (!hasCloudService() || !cloudService?.cloudAPI) {
				throw new Error("Cloud service not available")
			}

			const balance = await cloudService.cloudAPI.creditBalance()

			provider.postMessageToWebview({
				type: "rooCreditBalance",
				requestId,
				values: { balance },
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			provider.postMessageToWebview({
				type: "rooCreditBalance",
				requestId,
				values: { error: errorMessage },
			})
		}
	},

	requestVsCodeLmModels: async (provider, _message) => {
		const vsCodeLmModels = await getVsCodeLmModels()
		provider.postMessageToWebview({ type: "vsCodeLmModels", vsCodeLmModels })
		getMstState(provider).routerModelsStore?.setVsCodeLmModels(vsCodeLmModels)
	},

	flushRouterModels: async (_provider, message) => {
		const routerNameFlush: RouterName = toRouterName(message.text)
		await flushModels({ provider: routerNameFlush } as GetModelsOptions, true)
	},
}
