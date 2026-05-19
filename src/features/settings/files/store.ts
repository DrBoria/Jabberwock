import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../../core/webview/EventBridge"
import { getState } from "../../storeSingleton"

export const FilesModel = types.model("Files", {})

export type IFilesModel = Instance<typeof FilesModel>

// Backward-compatible types and functions
export type FilesState = object

export function initFilesState(_provider: EventBridge): void {}

export function getFilesState(provider: EventBridge): FilesState {
	return getState(provider).settings.files as FilesState
}
