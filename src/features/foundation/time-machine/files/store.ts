import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "@features/foundation/webview/EventBridge"
import { getState } from "@features/storeSingleton"

export const FilesModel = types.model("Files", {})

export type IFilesModel = Instance<typeof FilesModel>

// Backward-compatible types and functions
export type FilesState = object

export function initFilesState(_provider: EventBridge): void {}

import type { IBackendRootStore } from "../../../store"

export function getFilesState(rootStore: IBackendRootStore): FilesState {
	return rootStore.settings.files as FilesState
}
