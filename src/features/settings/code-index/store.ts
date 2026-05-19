import { types, Instance } from "mobx-state-tree"
import type { EventBridge } from "../../../core/webview/EventBridge"
import { getState } from "../../storeSingleton"

import type { CodeIndexManager } from "../../../services/code-index/manager"

/**
 * Custom MST type for storing a reference to a CodeIndexManager instance.
 * The instance itself is non-serializable, so the snapshot is just a label.
 */
const CodeIndexManagerRef = types.custom<string, CodeIndexManager | null>({
	name: "CodeIndexManagerRef",
	fromSnapshot() {
		return null
	},
	toSnapshot() {
		return ""
	},
	isTargetType(value: unknown): value is CodeIndexManager {
		return value !== null && typeof value === "object"
	},
	getValidationMessage() {
		return ""
	},
})

export const CodeIndexModel = types.model("CodeIndex", {
	codeIndexManager: CodeIndexManagerRef,
})

export type ICodeIndexModel = Instance<typeof CodeIndexModel>

// Backward-compatible types and functions
export interface CodeIndexState {
	codeIndexManager?: CodeIndexManager
}

export function initCodeIndexState(_provider: EventBridge): void {}

export function getCodeIndexState(provider: EventBridge): CodeIndexState {
	return getState(provider).settings.codeIndex as CodeIndexState
}
