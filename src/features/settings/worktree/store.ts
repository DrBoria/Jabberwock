import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../../core/webview/EventBridge"
import { getState } from "../../storeSingleton"

export const WorktreeModel = types.model("Worktree", {})

export type IWorktreeModel = Instance<typeof WorktreeModel>

// Backward-compatible types and functions
export type WorktreeState = object

export function initWorktreeState(_provider: EventBridge): void {}

export function getWorktreeState(provider: EventBridge): WorktreeState {
	return getState(provider).settings.worktree as WorktreeState
}
