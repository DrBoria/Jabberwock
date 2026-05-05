import { types, Instance } from "mobx-state-tree"

/**
 * RouterModelsStore — tracks router model lists.
 * Receives snapshots from the extension-side RouterModelsStore via MstBridge.
 */
export const RouterModelsStore = types
	.model("RouterModelsStore", {
		routerModels: types.maybe(types.frozen<any>()),
		ollamaModels: types.maybe(types.frozen<any>()),
		lmStudioModels: types.maybe(types.frozen<any>()),
		openAiModels: types.maybe(types.frozen<any>()),
		vsCodeLmModels: types.maybe(types.frozen<any>()),
	})
	.actions((self) => ({
		setRouterModels(models: any) {
			self.routerModels = models
		},
		setOllamaModels(models: any) {
			self.ollamaModels = models
		},
		setLmStudioModels(models: any) {
			self.lmStudioModels = models
		},
		setOpenAiModels(models: any) {
			self.openAiModels = models
		},
		setVsCodeLmModels(models: any) {
			self.vsCodeLmModels = models
		},
	}))

export type IRouterModelsStore = Instance<typeof RouterModelsStore>
export const routerModelsStore = RouterModelsStore.create({})
