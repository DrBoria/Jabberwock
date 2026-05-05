import { types, Instance } from "mobx-state-tree"
import React, { createContext, useContext } from "react"

import { vscode } from "@jabberwock/devtool/react"
import type { ClineAskResponse } from "@jabberwock/types"

import { ChatStore as TreeStore } from "./messages-list/store"
import { CommandExecutionStore } from "./messages-list/store"
import { McpExecutionStore } from "./notifications/mcp/store"

// ── AggregatedCostEntry ──────────────────────────────────────────────

/**
 * Aggregated cost entry for a task node.
 */
export const AggregatedCostEntry = types.model("AggregatedCostEntry", {
	totalCost: types.number,
	ownCost: types.number,
	childrenCost: types.number,
})

/**
 * Checkpoint warning info.
 */
export const CheckpointWarning = types.model("CheckpointWarning", {
	type: types.enumeration(["WAIT_TIMEOUT", "INIT_TIMEOUT"]),
	timeout: types.number,
})

// ── CommandsStore ────────────────────────────────────────────────────

/**
 * CommandsStore — tracks available slash commands.
 * Receives snapshots from the extension-side CommandsStore via MstBridge.
 */
export const CommandsStore = types
	.model("CommandsStore", {
		commands: types.optional(types.array(types.frozen<any>()), []),
	})
	.actions((self) => ({
		setCommands(commands: any[]) {
			self.commands.replace(commands)
		},
	}))

export type ICommandsStore = Instance<typeof CommandsStore>

// ── ChatUIStore ──────────────────────────────────────────────────────

/**
 * ChatUIStore — holds all UI-level state that was previously local React state
 * in ChatView.tsx and ChatTextArea.tsx. Components read from this store directly
 * instead of receiving props drilled from ChatView.
 */
export const ChatUIStore = types
	.model("ChatUIStore", {
		// ── Input state ──
		inputValue: types.optional(types.string, ""),
		selectedImages: types.optional(types.array(types.string), []),
		sendingDisabled: types.optional(types.boolean, false),

		// ── Message list state ──
		expandedRows: types.optional(types.frozen<Record<number, boolean>>(), {}),
		currentFollowUpTs: types.maybeNull(types.number),

		// ── Streaming / task state ──
		isCondensing: types.optional(types.boolean, false),
		checkpointWarning: types.maybeNull(types.safeReference(CheckpointWarning)),

		// ── Announcement / upsell ──
		showAnnouncementModal: types.optional(types.boolean, false),
		showRetiredProviderWarning: types.optional(types.boolean, false),

		// ── Costs ──
		aggregatedCostsMap: types.optional(
			types.frozen<Map<string, { totalCost: number; ownCost: number; childrenCost: number }>>(),
			new Map(),
		),

		// ── TTS ──
		isTtsPlaying: types.optional(types.boolean, false),
	})
	.actions((self) => ({
		// ── Input actions ──
		setInputValue(value: string) {
			self.inputValue = value
		},
		setSelectedImages(images: string[]) {
			self.selectedImages.replace(images)
		},
		appendSelectedImages(images: string[]) {
			self.selectedImages.push(...images)
		},
		clearInput() {
			self.inputValue = ""
			self.selectedImages.clear()
		},
		setSendingDisabled(val: boolean) {
			self.sendingDisabled = val
		},

		// ── Expanded rows ──
		setExpandedRows(rows: Record<number, boolean>) {
			self.expandedRows = rows
		},
		toggleRowExpansion(ts: number) {
			self.expandedRows = { ...self.expandedRows, [ts]: !self.expandedRows[ts] }
		},
		setRowExpanded(ts: number, expand: boolean) {
			self.expandedRows = { ...self.expandedRows, [ts]: expand }
		},

		// ── Follow-up ──
		setCurrentFollowUpTs(ts: number | null) {
			self.currentFollowUpTs = ts
		},

		// ── Condensing ──
		setIsCondensing(val: boolean) {
			self.isCondensing = val
		},

		// ── Checkpoint warning ──
		setCheckpointWarning(warning: { type: "WAIT_TIMEOUT" | "INIT_TIMEOUT"; timeout: number } | null) {
			self.checkpointWarning = warning as { type: "WAIT_TIMEOUT" | "INIT_TIMEOUT"; timeout: number } | null
		},

		// ── Announcement ──
		setShowAnnouncementModal(val: boolean) {
			self.showAnnouncementModal = val
		},

		// ── Retired provider warning ──
		setShowRetiredProviderWarning(val: boolean) {
			self.showRetiredProviderWarning = val
		},

		// ── Costs ──
		setAggregatedCostsMap(map: Map<string, { totalCost: number; ownCost: number; childrenCost: number }>) {
			self.aggregatedCostsMap = map
		},
		updateAggregatedCosts(key: string, value: { totalCost: number; ownCost: number; childrenCost: number }) {
			const m = new Map(self.aggregatedCostsMap)
			m.set(key, value)
			self.aggregatedCostsMap = m
		},

		// ── TTS ──
		setIsTtsPlaying(val: boolean) {
			self.isTtsPlaying = val
		},

		// ── Bulk reset ──
		resetTaskUI() {
			self.expandedRows = {}
			self.currentFollowUpTs = null
			self.isCondensing = false
			self.checkpointWarning = null
		},
	}))

export type IChatUIStore = Instance<typeof ChatUIStore>

// ── Unified ChatStore ────────────────────────────────────────────────

/**
 * Unified ChatStore — composes all chat sub-stores and exposes high-level
 * actions that components can call directly instead of wiring through props.
 *
 * Components should use `useChatStore()` to access the store and call actions
 * like `chatStore.sendMessage(text, images)`, `chatStore.switchMode(slug)`,
 * `chatStore.respondToAsk(response, text, images)`, etc.
 */
export const ChatStore = types
	.model("ChatStore", {
		ui: types.optional(ChatUIStore, () => ChatUIStore.create({})),
		tree: types.optional(TreeStore, () => TreeStore.create({ nodes: {} })),
		commands: types.optional(CommandsStore, () => CommandsStore.create({})),
		commandExecution: types.optional(CommandExecutionStore, () => CommandExecutionStore.create({})),
		mcpExecution: types.optional(McpExecutionStore, () => McpExecutionStore.create({})),
	})
	.actions((self) => ({
		// ── Send message ───────────────────────────────────────────
		sendMessage(text: string, images: string[]) {
			const trimmed = text.trim()
			if (!trimmed && images.length === 0) return
			vscode.postMessage({ type: "newTask", text: trimmed, images })
			self.ui.clearInput()
		},

		// ── Ask response ───────────────────────────────────────────
		respondToAsk(response: ClineAskResponse, text?: string, images?: string[]) {
			vscode.postMessage({
				type: "askResponse",
				askResponse: response,
				text,
				images,
			})
			self.ui.clearInput()
			self.ui.setSendingDisabled(true)
		},

		// ── Queue message ──────────────────────────────────────────
		queueMessage(text: string, images: string[]) {
			vscode.postMessage({ type: "queueMessage", text, images })
			self.ui.clearInput()
		},

		// ── Clear / cancel task ────────────────────────────────────
		clearTask() {
			vscode.postMessage({ type: "clearTask" })
			self.ui.clearInput()
			self.ui.setSendingDisabled(false)
		},

		cancelTask() {
			vscode.postMessage({ type: "cancelTask" })
		},

		// ── Mode switching ─────────────────────────────────────────
		switchMode(modeSlug: string) {
			vscode.postMessage({ type: "mode", text: modeSlug })
		},

		// ── Terminal operations ────────────────────────────────────
		terminalOperation(operation: "continue" | "abort") {
			vscode.postMessage({ type: "terminalOperation", terminalOperation: operation })
		},

		// ── Navigate to task ───────────────────────────────────────
		navigateToTask(taskId: string) {
			self.tree.navigateToNode(taskId)
			vscode.postMessage({ type: "showTaskWithId", text: taskId })
		},

		// ── Condense context ───────────────────────────────────────
		condenseContext(taskId: string) {
			if (self.ui.isCondensing || self.ui.sendingDisabled) return
			self.ui.setIsCondensing(true)
			self.ui.setSendingDisabled(true)
			vscode.postMessage({ type: "condenseTaskContextRequest", text: taskId })
		},

		// ── Select images ──────────────────────────────────────────
		selectImages() {
			vscode.postMessage({ type: "selectImages" })
		},

		// ── Batch file response ────────────────────────────────────
		batchFileResponse(response: { [key: string]: boolean }) {
			vscode.postMessage({
				type: "askResponse",
				askResponse: "objectResponse",
				text: JSON.stringify(response),
			})
		},
	}))
	.views((self) => ({
		/** The mode name of the currently active task node, or "Agent" if unknown. */
		get activeModeName(): string {
			const activeNode = self.tree.activeNodeId
			if (activeNode && activeNode.mode) {
				return activeNode.mode
			}
			return "Agent"
		},

		/** Whether there is an active task. */
		get hasActiveTask(): boolean {
			return self.tree.activeNodeId !== undefined
		},
	}))

export type IChatStore = Instance<typeof ChatStore>

/** Singleton instance of the unified ChatStore. */
export const chatStore = ChatStore.create({})

// ── React Context bridge for ChatUIStore ─────────────────────────────

const ChatUIContext = createContext<IChatUIStore | undefined>(undefined)

export const ChatUIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	return <ChatUIContext.Provider value={chatStore.ui}>{children}</ChatUIContext.Provider>
}

export const useChatUI = (): IChatUIStore => {
	const context = useContext(ChatUIContext)
	if (context === undefined) {
		throw new Error("useChatUI must be used within a ChatUIProvider")
	}
	return context
}

// ── Re-export sub-store types for convenience ──────────────────────
export type { ICommandExecutionStore } from "./messages-list/store"
export type { IMcpExecutionStore } from "./notifications/mcp/store"
