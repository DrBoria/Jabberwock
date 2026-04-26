import { types, Instance } from "mobx-state-tree"

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

export const chatUIStore = ChatUIStore.create({})
