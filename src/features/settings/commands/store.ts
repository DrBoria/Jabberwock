import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../../core/webview/EventBridge"
import { getState } from "../../storeSingleton"

export const CommandsModel = types.model("Commands", {})

export type ICommandsModel = Instance<typeof CommandsModel>

// Backward-compatible types and functions
export type CommandsState = object

export function initCommandsState(_provider: EventBridge): void {}

export function getCommandsState(provider: EventBridge): CommandsState {
	return getState(provider).settings.commands as CommandsState
}
