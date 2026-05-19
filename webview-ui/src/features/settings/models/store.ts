import { types, Instance } from "mobx-state-tree"
import type { ModelRecord, RouterModels } from "@jabberwock/types"

/**
 * RouterModelsStore — tracks router model lists.
 * Receives snapshots from the extension-side RouterModelsStore via MstBridge.
 */
export const RouterModelsStore = types
	.model("RouterModelsStore", {
		routerModels: types.frozen<RouterModels>(),
		ollamaModels: types.frozen<ModelRecord>(),
		lmStudioModels: types.frozen<ModelRecord>(),
		openAiModels: types.frozen<string[]>(),
		vsCodeLmModels: types.frozen<{ vendor?: string; family?: string; version?: string; id?: string }[]>(),
	})
	.actions((self) => ({
		setRouterModels(models: RouterModels) {
			self.routerModels = models
		},
		setOllamaModels(models: ModelRecord) {
			self.ollamaModels = models
		},
		setLmStudioModels(models: ModelRecord) {
			self.lmStudioModels = models
		},
		setOpenAiModels(models: string[]) {
			self.openAiModels = models
		},
		setVsCodeLmModels(models: { vendor?: string; family?: string; version?: string; id?: string }[]) {
			self.vsCodeLmModels = models
		},
	}))

export type IRouterModelsStore = Instance<typeof RouterModelsStore>
export const routerModelsStore = RouterModelsStore.create({
	routerModels: {
		openrouter: {},
		"vercel-ai-gateway": {},
		litellm: {},
		requesty: {},
		jabberwock: {},
		unbound: {},
		ollama: {},
		lmstudio: {},
	},
	ollamaModels: {},
	lmStudioModels: {},
	openAiModels: [],
	vsCodeLmModels: [],
})
