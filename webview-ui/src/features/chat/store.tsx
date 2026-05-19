import { types, Instance } from "mobx-state-tree"

import type { ClineMessage, Command } from "@jabberwock/types"

import { ChatStore as TreeStore } from "./messages-list/store"
import { CommandExecutionStore } from "./messages-list/store"
import { McpExecutionStore } from "./notifications/mcp/store"
import { NotificationsStore } from "./notifications/store"
import { AskStore } from "./notifications/ask/store"

// ── Factory imports (chat-scoped action modules) ────────────────────
import { createTaskActions } from "./task/store"
import { createTopicActions } from "./topic/store"
import { createMessagesListActions } from "./messages-list/store"
import { createNotificationsActions } from "./notifications/store"
import { createTextAreaActions } from "./text-area/store"

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
		commands: types.array(types.frozen<Command>()),
	})
	.actions((self) => ({
		setCommands(commands: Command[]) {
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
		inputValue: types.string,
		selectedImages: types.array(types.string),
		sendingDisabled: types.boolean,

		// ── Message list state ──
		expandedRows: types.frozen<Record<number, boolean>>(),
		currentFollowUpTs: types.number,

		// ── Streaming / task state ──
		isCondensing: types.boolean,
		checkpointWarning: types.safeReference(CheckpointWarning),

		// ── Announcement / upsell ──
		showAnnouncementModal: types.boolean,
		showRetiredProviderWarning: types.boolean,

		// ── Costs ──
		aggregatedCostsMap: types.frozen<Map<string, { totalCost: number; ownCost: number; childrenCost: number }>>(),

		// ── TTS ──
		isTtsPlaying: types.boolean,

		// ── Ask/Say button state (synced from view.tsx via syncAskState) ──
		isStreaming: types.boolean,
		isFollowUpAutoApprovalPaused: types.boolean,
		enableButtons: types.boolean,
		primaryButtonText: types.string,
		secondaryButtonText: types.string,
		clineAsk: types.string,

		// ── Scroll state (synced from view.tsx) ──
		showScrollToBottom: types.boolean,

		// ── API metrics (synced from view.tsx) ──
		apiMetrics: types.frozen<{
			totalTokensIn: number
			totalTokensOut: number
			totalCacheWrites?: number
			totalCacheReads?: number
			totalCost: number
			contextTokens: number
		}>(),
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
		setCurrentFollowUpTs(ts: number) {
			self.currentFollowUpTs = ts
		},

		// ── Condensing ──
		setIsCondensing(val: boolean) {
			self.isCondensing = val
		},

		// ── Checkpoint warning ──
		setCheckpointWarning(warning: { type: "WAIT_TIMEOUT" | "INIT_TIMEOUT"; timeout: number } | undefined) {
			self.checkpointWarning = warning as { type: "WAIT_TIMEOUT" | "INIT_TIMEOUT"; timeout: number } | undefined
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

		// ── Ask/Say state setters (written by AskStore actions) ──
		setClineAsk(val: string) {
			self.clineAsk = val
		},
		setEnableButtons(val: boolean) {
			self.enableButtons = val
		},
		setPrimaryButtonText(val: string) {
			self.primaryButtonText = val
		},
		setSecondaryButtonText(val: string) {
			self.secondaryButtonText = val
		},
		setIsStreaming(val: boolean) {
			self.isStreaming = val
		},
		setIsFollowUpAutoApprovalPaused(val: boolean) {
			self.isFollowUpAutoApprovalPaused = val
		},

		// ── Scroll state sync ──
		setShowScrollToBottom(val: boolean) {
			self.showScrollToBottom = val
		},

		// ── API metrics sync ──
		setApiMetrics(metrics: {
			totalTokensIn: number
			totalTokensOut: number
			totalCacheWrites?: number
			totalCacheReads?: number
			totalCost: number
			contextTokens: number
		}) {
			self.apiMetrics = metrics
		},

		// ── Bulk reset ──
		resetTaskUI() {
			self.expandedRows = {}
			self.currentFollowUpTs = 0
			self.isCondensing = false
			self.checkpointWarning = undefined
		},
	}))

export type IChatUIStore = Instance<typeof ChatUIStore>
import { useRootStore } from "../store"

/**
 * Backward-compatible hook for consuming components.
 * Returns the ChatUI store from the root store singleton.
 * Components should migrate to `useRootStore().chat.ui` directly.
 */
export const useChatUI = (): IChatUIStore => useRootStore().chat.ui

// ── ChatStore (chat-scoped root) ──────────────────────────────────────

/**
 * ChatStore — composes all chat sub-stores and exposes chat-scoped actions.
 * Owned by RootStore as a sub-store under `rootStore.chat`.
 *
 * Components should use `rootStore.chat.xxx` to access chat state and actions.
 */
export const ChatStore = types
	.model("ChatStore", {
		// ── Chat sub-stores ──
		ui: types.optional(ChatUIStore, () =>
			ChatUIStore.create({
				inputValue: "",
				selectedImages: [],
				sendingDisabled: false,
				expandedRows: {},
				currentFollowUpTs: 0,
				isCondensing: false,
				showAnnouncementModal: false,
				showRetiredProviderWarning: false,
				aggregatedCostsMap: new Map(),
				isTtsPlaying: false,
				isStreaming: false,
				isFollowUpAutoApprovalPaused: false,
				enableButtons: false,
				primaryButtonText: "",
				secondaryButtonText: "",
				clineAsk: "",
				showScrollToBottom: false,
				apiMetrics: {
					totalTokensIn: 0,
					totalTokensOut: 0,
					totalCost: 0,
					contextTokens: 0,
				},
			}),
		),
		tree: types.optional(TreeStore, () => TreeStore.create({ nodes: {}, isNavigating: false })),
		commands: types.optional(CommandsStore, () => CommandsStore.create({ commands: [] })),
		commandExecution: types.optional(CommandExecutionStore, () => CommandExecutionStore.create({})),
		mcpExecution: types.optional(McpExecutionStore, () => McpExecutionStore.create({})),
		notifications: types.optional(NotificationsStore, () => NotificationsStore.create({})),
		ask: types.optional(AskStore, () => AskStore.create({})),
	})
	// ── Block 1: All chat domain actions (from chat-scoped factories) ──
	.actions((self) => ({
		...createTaskActions(self),
		...createTopicActions(self),
		...createMessagesListActions(self),
		...createNotificationsActions(self),
		...createTextAreaActions(self),
	}))
	// ── Block 2: Primary / Secondary button handlers ──
	.actions((self) => ({
		handlePrimaryButtonClick(
			clineAsk: string | undefined,
			currentTaskItem: { parentTaskId?: string } | undefined,
			messages: ClineMessage[],
			text?: string,
			images?: string[],
		) {
			const trimmedInput = text?.trim()
			switch (clineAsk) {
				case "api_req_failed":
				case "command":
				case "tool":
				case "use_mcp_server":
				case "mistake_limit_reached":
					if (trimmedInput || (images && images.length > 0)) {
						self.respondToAsk("yesButtonClicked", trimmedInput, images)
					} else {
						self.respondToAsk("yesButtonClicked")
					}
					break
				case "resume_task":
					if (
						currentTaskItem?.parentTaskId &&
						messages.some((msg) => msg.ask === "completion_result" || msg.say === "completion_result")
					) {
						self.clearTask()
					} else {
						if (trimmedInput || (images && images.length > 0)) {
							self.respondToAsk("yesButtonClicked", trimmedInput, images)
						} else {
							self.respondToAsk("yesButtonClicked")
						}
					}
					break
				case "completion_result":
				case "resume_completed_task":
					self.clearTask()
					break
			}
			self.ui.setSendingDisabled(true)
		},

		// ── Secondary button click ──
		handleSecondaryButtonClick(
			clineAsk: string | undefined,
			_isStreaming: boolean,
			text?: string,
			images?: string[],
		) {
			const trimmedInput = text?.trim()
			switch (clineAsk) {
				case "api_req_failed":
				case "mistake_limit_reached":
				case "resume_task":
					self.clearTask()
					break
				case "command":
				case "tool":
				case "use_mcp_server":
					if (trimmedInput || (images && images.length > 0)) {
						self.respondToAsk("noButtonClicked", trimmedInput, images)
					} else {
						self.respondToAsk("noButtonClicked")
					}
					break
				default:
					self.respondToAsk("noButtonClicked", trimmedInput, images)
					break
			}
			self.ui.setSendingDisabled(true)
		},
	}))

export type IChatStore = Instance<typeof ChatStore>

/** Singleton instance of ChatStore. */
export const chatStore = ChatStore.create({
	ui: {
		inputValue: "",
		selectedImages: [],
		sendingDisabled: false,
		expandedRows: {},
		currentFollowUpTs: 0,
		isCondensing: false,
		showAnnouncementModal: false,
		showRetiredProviderWarning: false,
		aggregatedCostsMap: new Map(),
		isTtsPlaying: false,
		isStreaming: false,
		isFollowUpAutoApprovalPaused: false,
		enableButtons: false,
		primaryButtonText: "",
		secondaryButtonText: "",
		clineAsk: "",
		showScrollToBottom: false,
		apiMetrics: {
			totalTokensIn: 0,
			totalTokensOut: 0,
			totalCost: 0,
			contextTokens: 0,
		},
	},
	tree: { nodes: {}, activeNodeId: undefined, isNavigating: false },
	commands: { commands: [] },
	commandExecution: { executions: [] },
	mcpExecution: { executions: [] },
	notifications: {},
	ask: {},
})

// ── Re-export sub-store types for convenience ──────────────────────
export type { ICommandExecutionStore } from "./messages-list/store"
export type { IMcpExecutionStore } from "./notifications/mcp/store"
