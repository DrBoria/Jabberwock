import { types, Instance } from "mobx-state-tree"
import type { Command } from "@jabberwock/types"
import { ContextMenuOptionType } from "@sections/dndTextArea/utils/context-mentions/context-mentions"
import { ChatStore as TreeStore, CommandExecutionStore, createMessagesListActions } from "@src/features/chat/tree/store"
import { McpExecutionStore } from "@src/features/chat/mcp/store"
import { NotificationsStore, createNotificationsActions } from "@src/features/chat/notifications/store"
import { AskStore } from "@src/features/chat/ask/store"
import { createTaskActions, type TaskActionsParams } from "@src/features/chat/task/store"
import { createTopicActions } from "@src/features/chat/topic/store"
import { DynamicTextAreaStore, createTextAreaActions } from "@sections/dndTextArea/store"
import { useRootStore } from "@src/features/useRootStore"

// ── Inline model definitions ─────────────────────────────────────────────

const ChatCheckpointWarning = types.model("ChatCheckpointWarning", {
	type: types.enumeration(["WAIT_TIMEOUT", "INIT_TIMEOUT"]),
	timeout: types.number,
})

const ChatCommandsStore = types
	.model("ChatCommandsStore", { commands: types.array(types.frozen<Command>()) })
	.actions((self) => ({
		setCommands(commands: Command[]) {
			self.commands.replace(commands)
		},
	}))

export const ChatStore = types
	.model("ChatStore", {
		expandedRows: types.optional(types.frozen<Record<number, boolean>>(), () => ({})),
		currentFollowUpTs: types.optional(types.number, 0),
		isCondensing: types.optional(types.boolean, false),
		checkpointWarning: types.maybe(ChatCheckpointWarning),
		showAnnouncementModal: types.optional(types.boolean, false),
		showRetiredProviderWarning: types.optional(types.boolean, false),
		aggregatedCostsMap: types.optional(
			types.frozen<Map<string, { totalCost: number; ownCost: number; childrenCost: number }>>(),
			() => new Map(),
		),
		isTtsPlaying: types.optional(types.boolean, false),
		isStreaming: types.optional(types.boolean, false),
		isFollowUpAutoApprovalPaused: types.optional(types.boolean, false),
		enableButtons: types.optional(types.boolean, false),
		primaryButtonText: types.optional(types.string, ""),
		secondaryButtonText: types.optional(types.string, ""),
		currentAsk: types.optional(types.string, ""),
		showScrollToBottom: types.optional(types.boolean, false),
		apiMetrics: types.optional(
			types.frozen<{
				totalTokensIn: number
				totalTokensOut: number
				totalCacheWrites?: number
				totalCacheReads?: number
				totalCost: number
				contextTokens: number
			}>(),
			() => ({ totalTokensIn: 0, totalTokensOut: 0, totalCost: 0, contextTokens: 0 }),
		),

		tree: types.optional(TreeStore, () => TreeStore.create({ nodes: {}, isNavigating: false })),
		commands: types.optional(ChatCommandsStore, () => ChatCommandsStore.create({ commands: [] })),
		commandExecution: types.optional(CommandExecutionStore, () => CommandExecutionStore.create({})),
		mcpExecution: types.optional(McpExecutionStore, () => McpExecutionStore.create({})),
		notifications: types.optional(NotificationsStore, () => NotificationsStore.create({})),
		ask: types.optional(AskStore, () => AskStore.create({})),
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

	.actions((self) => ({
		// ── Messages state ──
		setExpandedRows(rows: Record<number, boolean>) {
			self.expandedRows = rows
		},
		toggleRowExpansion(ts: number) {
			self.expandedRows = { ...self.expandedRows, [ts]: !self.expandedRows[ts] }
		},
		setRowExpanded(ts: number, expand: boolean) {
			self.expandedRows = { ...self.expandedRows, [ts]: expand }
		},
		setCurrentFollowUpTs(ts: number) {
			self.currentFollowUpTs = ts
		},
		setIsCondensing(val: boolean) {
			self.isCondensing = val
		},
		setCheckpointWarning(warning: { type: "WAIT_TIMEOUT" | "INIT_TIMEOUT"; timeout: number } | undefined) {
			self.checkpointWarning = warning ? ChatCheckpointWarning.create(warning) : undefined
		},
		setShowAnnouncementModal(val: boolean) {
			self.showAnnouncementModal = val
		},
		setShowRetiredProviderWarning(val: boolean) {
			self.showRetiredProviderWarning = val
		},
		setAggregatedCostsMap(map: Map<string, { totalCost: number; ownCost: number; childrenCost: number }>) {
			self.aggregatedCostsMap = map
		},
		updateAggregatedCosts(key: string, value: { totalCost: number; ownCost: number; childrenCost: number }) {
			const m = new Map(self.aggregatedCostsMap)
			m.set(key, value)
			self.aggregatedCostsMap = m
		},
		setIsTtsPlaying(val: boolean) {
			self.isTtsPlaying = val
		},
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
		setShowScrollToBottom(val: boolean) {
			self.showScrollToBottom = val
		},
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
		resetTaskUI() {
			self.expandedRows = {}
			self.currentFollowUpTs = 0
			self.isCondensing = false
			self.checkpointWarning = undefined
		},
	}))
	.actions((self) => ({
		...createTaskActions(self as TaskActionsParams),
		...createTopicActions(self),
		...createMessagesListActions(self),
		...createNotificationsActions(self),
		...createTextAreaActions(self),
	}))

export type IChatStore = Instance<typeof ChatStore>

export type IChatUIStore = IChatStore

export const useChatUI = (): IChatUIStore => useRootStore().chat
