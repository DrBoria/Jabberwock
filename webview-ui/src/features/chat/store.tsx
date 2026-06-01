import { types, Instance } from "mobx-state-tree"

import { ContextMenuOptionType } from "./text-area/utils/context-mentions"
import type { Notification, Command } from "@jabberwock/types"

import { ChatStore as TreeStore } from "@src/features/chat/task/messages/store"
import { CommandExecutionStore } from "@src/features/chat/task/messages/store"
import { McpExecutionStore } from "@src/features/chat/task/notifications/mcp/store"
import { NotificationsStore } from "@src/features/chat/task/notifications/store"
import { AskStore } from "@src/features/chat/task/notifications/ask/store"

// ── Factory imports (chat-scoped action modules) ────────────────────
import { createTaskActions } from "@src/features/chat/task/store"
import { createTopicActions } from "@src/features/chat/topic/store"
import { createMessagesListActions } from "@src/features/chat/task/messages/store"
import { createNotificationsActions } from "@src/features/chat/task/notifications/store"
import { DynamicTextAreaStore, createTextAreaActions } from "@src/features/chat/text-area/store"

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

// ── ChatStore (chat-scoped root) ──────────────────────────────────────

/**
 * ChatStore — composes all chat sub-stores and exposes all UI + domain actions.
 * Owned by RootStore as a sub-store under `rootStore.chat`.
 *
 * Previously, UI-level state lived in a separate ChatUIStore sub-store at
 * `chat.ui.X`. That sub-store has been flattened into ChatStore directly.
 * Backward-compat aliases (`useChatUI`, `IChatUIStore`) are preserved.
 */
export const ChatStore = types
	.model("ChatStore", {
		// ── UI state (formerly ChatUIStore, now inlined) ─────────────
		inputValue: types.optional(types.string, ""),
		selectedImages: types.optional(types.array(types.string), () => []),
		sendingDisabled: types.optional(types.boolean, false),

		// ── Message list state ──
		expandedRows: types.optional(types.frozen<Record<number, boolean>>(), () => ({})),
		currentFollowUpTs: types.optional(types.number, 0),

		// ── Streaming / task state ──
		isCondensing: types.optional(types.boolean, false),
		checkpointWarning: types.maybe(types.safeReference(CheckpointWarning)),

		// ── Announcement / upsell ──
		showAnnouncementModal: types.optional(types.boolean, false),
		showRetiredProviderWarning: types.optional(types.boolean, false),

		// ── Costs ──
		aggregatedCostsMap: types.optional(
			types.frozen<Map<string, { totalCost: number; ownCost: number; childrenCost: number }>>(),
			() => new Map(),
		),

		// ── TTS ──
		isTtsPlaying: types.optional(types.boolean, false),

		// ── Ask/Say button state (synced from view.tsx via syncAskState) ──
		isStreaming: types.optional(types.boolean, false),
		isFollowUpAutoApprovalPaused: types.optional(types.boolean, false),
		enableButtons: types.optional(types.boolean, false),
		primaryButtonText: types.optional(types.string, ""),
		secondaryButtonText: types.optional(types.string, ""),
		currentAsk: types.optional(types.string, ""),

		// ── Scroll state (synced from view.tsx) ──
		showScrollToBottom: types.optional(types.boolean, false),

		// ── API metrics (synced from view.tsx) ──
		apiMetrics: types.optional(
			types.frozen<{
				totalTokensIn: number
				totalTokensOut: number
				totalCacheWrites?: number
				totalCacheReads?: number
				totalCost: number
				contextTokens: number
			}>(),
			() => ({
				totalTokensIn: 0,
				totalTokensOut: 0,
				totalCost: 0,
				contextTokens: 0,
			}),
		),

		// ── Chat sub-stores ──
		tree: types.optional(TreeStore, () => TreeStore.create({ nodes: {}, isNavigating: false })),
		commands: types.optional(CommandsStore, () => CommandsStore.create({ commands: [] })),
		commandExecution: types.optional(CommandExecutionStore, () => CommandExecutionStore.create({})),
		mcpExecution: types.optional(McpExecutionStore, () => McpExecutionStore.create({})),
		notifications: types.optional(NotificationsStore, () => NotificationsStore.create({})),
		ask: types.optional(AskStore, () => AskStore.create({})),

		// ── Text area state ──
		textArea: types.optional(DynamicTextAreaStore, () =>
			DynamicTextAreaStore.create({
				cursorPosition: 0,
				intendedCursorPosition: -1,
				showContextMenu: false,
				selectedMenuIndex: -1,
				selectedType: ContextMenuOptionType.None,
				searchQuery: "",
				searchLoading: false,
				searchRequestId: "",
				isMouseDownOnMenu: false,
				justDeletedSpaceAfterMention: false,
				isDraggingOver: false,
				isFocused: false,
				showDropdown: false,
				gitCommits: [],
				fileSearchResults: [],
				isEnhancingPrompt: false,
				isTtsPlaying: false,
				textAreaBaseHeight: -1,
			}),
		),
	})
	// ── Block 0: UI actions (formerly ChatUIStore actions, now inlined) ──
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

		// ── Ask/Say state setters ──
		setCurrentAsk(val: string) {
			self.currentAsk = val
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
			currentAsk: string | undefined,
			currentTaskItem: { parentTaskId?: string } | undefined,
			messages: Notification[],
			text?: string,
			images?: string[],
		) {
			const trimmedInput = text?.trim()
			switch (currentAsk) {
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
			self.setSendingDisabled(true)
		},

		// ── Secondary button click ──
		handleSecondaryButtonClick(
			currentAsk: string | undefined,
			_isStreaming: boolean,
			text?: string,
			images?: string[],
		) {
			const trimmedInput = text?.trim()
			switch (currentAsk) {
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
			self.setSendingDisabled(true)
		},
	}))

export type IChatStore = Instance<typeof ChatStore>

// ── Backward-compat aliases (flattened ChatUIStore → ChatStore) ──

/**
 * @deprecated ChatUIStore has been flattened into ChatStore.
 * Use `IChatStore` directly. This alias is kept for backward compatibility.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IChatUIStore extends IChatStore {}

import { useRootStore } from "../store"

/**
 * Backward-compatible hook for consuming components.
 * Returns the ChatStore instance directly (all UI fields are now on ChatStore).
 *
 * @deprecated Use `useRootStore().chat` directly. This hook is kept for
 * backward compatibility during the flattening migration.
 */
export const useChatUI = (): IChatUIStore => useRootStore().chat

// ── Instance is created by RootStore — do NOT create module-level singleton ──
// Dual instantiation was a bug: https://mobx-state-tree.js.org/overview/component-integration
// Use `rootStore.chat` or `useRootStore().chat` instead.

// ── Re-export sub-store types for convenience ──────────────────────
export type { ICommandExecutionStore } from "./task/messages/store"
export type { IMcpExecutionStore } from "./task/notifications/mcp/store"
