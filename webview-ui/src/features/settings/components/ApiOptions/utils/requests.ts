import type { ProviderSettings } from "@jabberwock/types"
import { convertHeadersToObject } from "../../utils/headers"
import { rootStore } from "@src/features/store"

export function requestModelsForSelectedProvider(
	selectedProvider: string | undefined,
	apiConfiguration: ProviderSettings,
	customHeaders: [string, string][],
): void {
	if (selectedProvider === "openai") {
		const headerObject = convertHeadersToObject(customHeaders)
		rootStore.settings.requestOpenAiModels({
			baseUrl: apiConfiguration?.openAiBaseUrl,
			apiKey: apiConfiguration?.openAiApiKey,
			customHeaders: {},
			openAiHeaders: headerObject,
		})
	} else if (selectedProvider === "ollama") {
		rootStore.settings.requestOllamaModels()
	} else if (selectedProvider === "lmstudio") {
		rootStore.settings.requestLmStudioModels()
	} else if (selectedProvider === "vscode-lm") {
		rootStore.settings.requestVscodeLmModels()
	} else if (selectedProvider === "litellm" || selectedProvider === "jabberwock") {
		rootStore.settings.requestRouterModels()
	}
}
