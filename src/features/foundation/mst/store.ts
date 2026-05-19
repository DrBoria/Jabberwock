import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../../core/webview/EventBridge"
import { StoreRefType } from "../../mst-custom-types"

// Lazy require to avoid circular dependency: store.ts → foundation/store.ts → mst/store.ts → store.ts
function lazyGetState(provider: EventBridge): { foundation: { mst: unknown } } {
	const storeModule = require("../../store") as { getState: (p: EventBridge) => unknown }
	const rootStore = storeModule.getState(provider)
	return rootStore as { foundation: { mst: unknown } }
}

export const MstRefModel = types.model("MstRef", {
	subStoreRefs: types.array(StoreRefType),
})

export type IMstRefModel = Instance<typeof MstRefModel>

// Backward-compatible types and functions
export interface MstState {
	subStoreRefs: Record<string, unknown>[]
	commandExecutionStore?: {
		addOrUpdateExecution(status: unknown): void
	}
	mcpExecutionStore?: {
		addOrUpdateExecution(status: unknown): void
	}
	checkpointStore?: {
		setCurrentCheckpoint(hash: string): void
	}
	taskHistoryStore?: Record<string, unknown>
	skillsStore?: {
		setSkills(skills: unknown[]): void
	}
	commandsStore?: {
		setCommands(commands: unknown[]): void
	}
	routerModelsStore?: {
		setRouterModels(models: unknown): void
		setOpenAiModels(models: unknown): void
		setOllamaModels(models: unknown): void
		setLmStudioModels(models: unknown): void
		setVsCodeLmModels(models: unknown): void
	}
	listApiConfigStore?: {
		setListApiConfig(config: unknown): void
	}
}

export function initMstState(_provider: EventBridge): void {
	// No-op — state is initialized via MST model defaults
}

export function getMstState(provider: EventBridge): MstState {
	return lazyGetState(provider).foundation.mst as MstState
}
