import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "@features/foundation/webview/EventBridge"
import { StoreRefType } from "../../mst-custom-types"
import { getState } from "@features/storeSingleton"

export const MstRefModel = types.model("MstRef", {
	subStoreRefs: types.array(StoreRefType),
})

export type IMstRefModel = Instance<typeof MstRefModel>

export type SubStoreRef = { [key: string]: unknown }

// Backward-compatible types and functions
export interface MstState {
	subStoreRefs: SubStoreRef[]
	commandExecutionStore?: {
		addOrUpdateExecution(status: unknown): void
	}
	mcpExecutionStore?: {
		addOrUpdateExecution(status: unknown): void
	}
	checkpointStore?: {
		setCurrentCheckpoint(hash: string): void
	}
	taskHistoryStore?: { [key: string]: unknown }
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
	mcpServersStore?: {
		setServers(servers: unknown[]): void
	}
}

export function initMstState(_provider: EventBridge): void {
	// No-op — state is initialized via MST model defaults
}

import type { IBackendRootStore } from "../../store"

export function getMstState(rootStore: IBackendRootStore): MstState {
	// The as cast is required because MstState is a backward-compatible interface
	// that generalizes the MST Instance type (IMstRefModel). The types are structurally
	// incompatible (IObservableArray vs Record[]), so a direct assignment fails.
	return rootStore.foundation.mst as MstState
}
