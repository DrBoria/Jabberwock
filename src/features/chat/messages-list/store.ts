import { types, getSnapshot } from "mobx-state-tree"
import { NodesMapType, CallbackType } from "../../mst-custom-types"
import type { EventBridge } from "../../../core/webview/EventBridge"
import { getState } from "../../storeSingleton"

// ─── Backward-compatible interface ─────────────────────────────────────
export interface MessagesListState {
	nodes: Map<
		string,
		{
			addMessage(msg: Record<string, unknown>): void
			syncUiMessages(msgs: unknown[]): void
			setMode(mode: string): void
		}
	>
	createBranch(parentId: string, label: string, taskId: string): void
	switchContext(taskId: string): void
}

// ─── MST Model ─────────────────────────────────────────────────────────
export const MessagesListModel = types
	.model("MessagesList", {
		nodes: NodesMapType,
		createBranch: CallbackType,
		switchContext: CallbackType,
	})
	.actions((self) => ({
		setCreateBranch(fn: (parentId: string, label: string, taskId: string) => void) {
			;(self as { createBranch: typeof fn }).createBranch = fn
		},
		setSwitchContext(fn: (taskId: string) => void) {
			;(self as { switchContext: typeof fn }).switchContext = fn
		},
		addNode(
			id: string,
			node: {
				addMessage(msg: Record<string, unknown>): void
				syncUiMessages(msgs: unknown[]): void
				setMode(mode: string): void
			},
		) {
			self.nodes.set(id, node)
		},
		removeNode(id: string) {
			self.nodes.delete(id)
		},
	}))

// ─── Backward-compatible init/get ──────────────────────────────────────

export function initMessagesListState(_provider: EventBridge): void {
	// MST default factory handles initialization
}

export function getMessagesListState(provider: EventBridge): MessagesListState {
	return getState(provider).chat.messagesList as MessagesListState
}
