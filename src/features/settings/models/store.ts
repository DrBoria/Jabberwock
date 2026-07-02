import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "@features/foundation/webview/EventBridge"
import { getState } from "@features/storeSingleton"

export const ModelsModel = types.model("Models", {})

const KNOWN_FIELDS = [
	"apiProvider",
	"apiModelId",
	"baseUrl",
	"apiKey",
	"includeMaxTokens",
	"todoListEnabled",
	"modelTemperature",
	"rateLimitSeconds",
	"consecutiveMistakeLimit",
	"enableReasoningEffort",
	"reasoningEffort",
	"modelMaxTokens",
	"modelMaxThinkingTokens",
	"verbosity",
	"id",
] as const

export const ApiConfigModel = types
	.model("ApiConfig", {
		// Identity
		id: types.string,
		currentConfigName: types.string,
		listApiConfigMeta: types.frozen<Array<{ name: string; id: string; apiProvider?: string; modelId?: string }>>(),

		// Core provider config (what buildApiHandler needs)
		apiProvider: types.string,
		apiModelId: types.string,
		baseUrl: types.string,

		// Common base settings (from baseProviderSettingsSchema)
		includeMaxTokens: types.boolean,
		todoListEnabled: types.boolean,
		modelTemperature: types.number,
		rateLimitSeconds: types.number,
		consecutiveMistakeLimit: types.number,
		enableReasoningEffort: types.boolean,
		reasoningEffort: types.string,
		modelMaxTokens: types.number,
		modelMaxThinkingTokens: types.number,
		verbosity: types.number,

		// Auth
		apiKey: types.string,

		// Provider-specific fields (catch-all for keys like openAiApiKey, bedrockApiKey, etc.)
		providerSpecificFields: types.frozen<{ [key: string]: unknown }>(),
	})
	.actions((self) => ({
		setConfiguration(config: { [key: string]: unknown }): void {
			const known = new Set<string>(KNOWN_FIELDS)
			const rest: { [key: string]: unknown } = {}

			for (const [key, value] of Object.entries(config)) {
				if (known.has(key)) {
					Object.assign(self, { [key]: value })
				} else {
					rest[key] = value
				}
			}

			self.providerSpecificFields = rest
		},

		setCurrentConfigName(name: string): void {
			self.currentConfigName = name
		},

		setListApiConfigMeta(list: Array<{ name: string; id: string; apiProvider?: string; modelId?: string }>): void {
			self.listApiConfigMeta = list
		},

		clear(): void {
			self.id = ""
			self.currentConfigName = ""
			self.listApiConfigMeta = []
			self.apiProvider = ""
			self.apiModelId = ""
			self.baseUrl = ""
			self.apiKey = ""
			self.includeMaxTokens = false
			self.todoListEnabled = false
			self.modelTemperature = 0
			self.rateLimitSeconds = 0
			self.consecutiveMistakeLimit = 0
			self.enableReasoningEffort = false
			self.reasoningEffort = ""
			self.modelMaxTokens = 0
			self.modelMaxThinkingTokens = 0
			self.verbosity = 0
			self.providerSpecificFields = {}
		},
	}))
	.views((self) => ({
		toProviderSettings(): { [key: string]: unknown } {
			const result: { [key: string]: unknown } = {
				...self.providerSpecificFields,
			}

			const fieldMappings: Array<{ key: string; get: () => unknown }> = [
				{ key: "id", get: () => self.id },
				{ key: "apiProvider", get: () => self.apiProvider },
				{ key: "apiModelId", get: () => self.apiModelId },
				{ key: "baseUrl", get: () => self.baseUrl },
				{ key: "apiKey", get: () => self.apiKey },
				{ key: "includeMaxTokens", get: () => self.includeMaxTokens },
				{ key: "todoListEnabled", get: () => self.todoListEnabled },
				{ key: "modelTemperature", get: () => self.modelTemperature },
				{ key: "rateLimitSeconds", get: () => self.rateLimitSeconds },
				{ key: "consecutiveMistakeLimit", get: () => self.consecutiveMistakeLimit },
				{ key: "enableReasoningEffort", get: () => self.enableReasoningEffort },
				{ key: "reasoningEffort", get: () => self.reasoningEffort },
				{ key: "modelMaxTokens", get: () => self.modelMaxTokens },
				{ key: "modelMaxThinkingTokens", get: () => self.modelMaxThinkingTokens },
				{ key: "verbosity", get: () => self.verbosity },
			]

			for (const { key, get } of fieldMappings) {
				const value = get()
				if (value !== undefined) {
					result[key] = value
				}
			}

			return result
		},
	}))
export type IModelsModel = Instance<typeof ModelsModel>
export type ModelsState = object

export function initModelsState(_provider: EventBridge): void {}

import type { IBackendRootStore } from "@features/store"

export function getModelsState(rootStore: IBackendRootStore): ModelsState {
	return rootStore.settings.models as ModelsState
}
