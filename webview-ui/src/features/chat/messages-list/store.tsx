import { types, applySnapshot, isAlive, isStateTreeNode, Instance, getParent } from "mobx-state-tree"

export const Message = types.model("Message", {
	id: types.identifier,
	role: types.string, // "user", "assistant", or default to "cline"
	content: types.frozen(), // For Anthropic-style multi-block content
	type: types.string, // cline: "say" or "ask"
	say: types.string, // cline: "text", "error", etc.
	ask: types.string, // cline: "tool", "followup", etc.
	text: types.string, // main text content or summary
	partial: types.boolean,
	images: types.array(types.string),
	ts: types.number,
})

export const TaskNode = types
	.model("TaskNode", {
		id: types.identifier,
		title: types.string,
		mode: types.string,
		status: types.enumeration(["pending", "in_progress", "completed", "failed"]),
		messages: types.array(Message),
		uiMessages: types.frozen<unknown[]>(),
		children: types.array(types.string),
		parentId: types.string,
		rootId: types.string,
	})
	.actions((self) => ({
		replaceMessages(newMessages: unknown[]) {
			self.messages.replace(newMessages as Instance<typeof Message>[])
		},
		syncUiMessages(uiMessages: unknown[]) {
			self.uiMessages = uiMessages
		},
		updateApiMessage(id: string, update: { role?: string; content?: unknown; text?: string; partial?: boolean }) {
			const msg = self.messages.find((m) => m.id === id)
			if (msg && (!isStateTreeNode(msg) || isAlive(msg))) {
				if (update.role) msg.role = update.role
				if (update.content) msg.content = update.content
				if (update.text !== undefined) msg.text = update.text
				if (update.partial !== undefined) msg.partial = update.partial
			}
		},
	}))
	.views((self) => ({
		get depth(): number {
			let d = 0
			let current = self.parentId
			const parentStore = getParent<{ nodes: Map<string, typeof self> }>(self, 2)
			const nodes = parentStore?.nodes
			while (current && nodes && nodes.has && nodes.has(current)) {
				d++
				current = nodes.get(current)?.parentId ?? ""
			}
			return d
		},
		get childTasks() {
			const parentStore = getParent<{ nodes: Map<string, typeof self> }>(self, 2)
			const nodes = parentStore?.nodes
			if (!nodes || !nodes.get) return []
			return self.children.map((id) => nodes.get(id)).filter(Boolean)
		},
	}))

export const ChatStore = types
	.model("ChatStore", {
		nodes: types.map(TaskNode),
		activeNodeId: types.safeReference(TaskNode),
		isNavigating: types.boolean,
	})
	.actions((self) => ({
		applyTreeSnapshot(snapshot: Record<string, unknown>) {
			applySnapshot(self, { ...snapshot, isNavigating: false })
			self.isNavigating = false
		},
		setNavigating(val: boolean) {
			self.isNavigating = val
		},
		navigateToNode(_id: string) {
			self.isNavigating = true
			// The actual VSCode message will be sent from the component
			// but we set the state here immediately to buffer the UI.
		},
	}))
	.views((self) => ({
		get activeHierarchy() {
			if (!self.activeNodeId) return []
			const path: Instance<typeof TaskNode>[] = []
			// MST resolves references automatically, so currentNode is a TaskNode
			let currentNode: Instance<typeof TaskNode> | undefined = self.activeNodeId
			while (currentNode) {
				path.unshift(currentNode)
				currentNode = currentNode.parentId ? self.nodes.get(currentNode.parentId) : undefined
			}
			return path
		},
	}))

export type IChatStore = Instance<typeof ChatStore>
import { useRootStore as _useRootStore } from "../../store"

/**
 * Backward-compatible hook for consuming components.
 * Returns the ChatTree store from the root store singleton.
 * Components should migrate to `useRootStore().chat.tree` directly.
 */
export const useChatTree = (): IChatStore => chatTreeStore

export const chatTreeStore = ChatStore.create({ nodes: {}, activeNodeId: undefined, isNavigating: false })

/**
 * CommandExecutionStore — holds command execution status snapshots pushed
 * from the extension via MstBridge.
 *
 * Replaces the `commandExecutionStatus` postMessage listener with MST
 * snapshot propagation.
 */
export const CommandExecutionStore = types
	.model("CommandExecutionStore", {
		executions: types.array(types.frozen<Record<string, unknown>>()),
	})
	.actions((self) => ({
		/** Replace the entire executions array from a snapshot. */
		setExecutions(executions: Record<string, unknown>[]) {
			self.executions.replace(executions)
		},
	}))

export type ICommandExecutionStore = Instance<typeof CommandExecutionStore>

/** Singleton store instance. */
export const commandExecutionStore = CommandExecutionStore.create({ executions: [] })

// ── Action factory for ChatStore composition ──────────────────────────

import { vscode } from "@jabberwock/devtool/react"
import type { WebviewMessage, ClineAskResponse } from "@jabberwock/types"
import {
	CHAT_MESSAGES_LIST_ASK_RESPONSE,
	CHAT_MESSAGES_LIST_DELETE_MESSAGE,
	CHAT_MESSAGES_LIST_DELETE_MESSAGE_CONFIRM,
	CHAT_MESSAGES_LIST_EDIT_MESSAGE_CONFIRM,
	CHAT_MESSAGES_LIST_SUBMIT_EDITED_MESSAGE,
	CHAT_TASK_TASK_SYNC_ENABLED,
} from "@jabberwock/types"

/**
 * Creates message-list actions for the ChatStore.
 * These send IPC messages to the extension for message-list operations.
 */
export function createMessagesListActions(self: {
	ui: {
		clearInput(): void
		setSendingDisabled(val: boolean): void
	}
}) {
	return {
		// ── Ask response ───────────────────────────────────────────
		respondToAsk(response: ClineAskResponse, text?: string, images?: string[]) {
			vscode.postMessage({
				type: CHAT_MESSAGES_LIST_ASK_RESPONSE,
				askResponse: response,
				text,
				images,
			} satisfies WebviewMessage)
			self.ui.clearInput()
			self.ui.setSendingDisabled(true)
		},

		// ── Delete message ─────────────────────────────────────────
		deleteMessage(value: number) {
			vscode.postMessage({
				type: CHAT_MESSAGES_LIST_DELETE_MESSAGE,
				value,
			} satisfies WebviewMessage)
		},

		// ── Submit edited message ──────────────────────────────────
		submitEditedMessage(value: number, editedMessageContent: string, images?: string[]) {
			vscode.postMessage({
				type: CHAT_MESSAGES_LIST_SUBMIT_EDITED_MESSAGE,
				value,
				editedMessageContent,
				...(images !== undefined && images.length > 0 && { images }),
			} satisfies WebviewMessage)
		},

		// ── Confirm delete message ─────────────────────────────────
		confirmDeleteMessage(messageTs: number, restoreCheckpoint?: boolean) {
			vscode.postMessage({
				type: CHAT_MESSAGES_LIST_DELETE_MESSAGE_CONFIRM,
				messageTs,
				...(restoreCheckpoint !== undefined && { restoreCheckpoint }),
			} satisfies WebviewMessage)
		},

		// ── Confirm edit message ───────────────────────────────────
		confirmEditMessage(messageTs: number, text: string, restoreCheckpoint?: boolean, images?: string[]) {
			vscode.postMessage({
				type: CHAT_MESSAGES_LIST_EDIT_MESSAGE_CONFIRM,
				messageTs,
				text,
				...(restoreCheckpoint !== undefined && { restoreCheckpoint }),
				...(images !== undefined && images.length > 0 && { images }),
			} satisfies WebviewMessage)
		},

		// ── Task sync enabled ──────────────────────────────────────
		taskSyncEnabled(bool: boolean) {
			vscode.postMessage({
				type: CHAT_TASK_TASK_SYNC_ENABLED,
				bool,
			} satisfies WebviewMessage)
		},
	}
}
