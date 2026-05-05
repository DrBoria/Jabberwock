import { types, Instance } from "mobx-state-tree"

/**
 * DynamicTextAreaStore — manages local state for the DynamicTextArea component.
 * This includes cursor position, context menu state, search state, and other
 * UI-level concerns that don't belong in the global ChatUIStore.
 */
export const DynamicTextAreaStore = types
	.model("DynamicTextAreaStore", {
		// ── Cursor / selection ──
		cursorPosition: types.optional(types.number, 0),
		intendedCursorPosition: types.maybeNull(types.number),

		// ── Context menu ──
		showContextMenu: types.optional(types.boolean, false),
		selectedMenuIndex: types.optional(types.number, -1),
		selectedType: types.maybeNull(types.string),
		searchQuery: types.optional(types.string, ""),
		searchLoading: types.optional(types.boolean, false),
		searchRequestId: types.optional(types.string, ""),
		isMouseDownOnMenu: types.optional(types.boolean, false),
		justDeletedSpaceAfterMention: types.optional(types.boolean, false),

		// ── Drag / focus ──
		isDraggingOver: types.optional(types.boolean, false),
		isFocused: types.optional(types.boolean, false),

		// ── Enhancement ──
		isEnhancingPrompt: types.optional(types.boolean, false),

		// ── TTS ──
		isTtsPlaying: types.optional(types.boolean, false),
	})
	.actions((self) => ({
		setCursorPosition(pos: number) {
			self.cursorPosition = pos
		},
		setIntendedCursorPosition(pos: number | null) {
			self.intendedCursorPosition = pos
		},
		setShowContextMenu(val: boolean) {
			self.showContextMenu = val
		},
		setSelectedMenuIndex(index: number) {
			self.selectedMenuIndex = index
		},
		setSelectedType(type: string | null) {
			self.selectedType = type
		},
		setSearchQuery(query: string) {
			self.searchQuery = query
		},
		setSearchLoading(val: boolean) {
			self.searchLoading = val
		},
		setSearchRequestId(id: string) {
			self.searchRequestId = id
		},
		setIsMouseDownOnMenu(val: boolean) {
			self.isMouseDownOnMenu = val
		},
		setJustDeletedSpaceAfterMention(val: boolean) {
			self.justDeletedSpaceAfterMention = val
		},
		setIsDraggingOver(val: boolean) {
			self.isDraggingOver = val
		},
		setIsFocused(val: boolean) {
			self.isFocused = val
		},
		setIsEnhancingPrompt(val: boolean) {
			self.isEnhancingPrompt = val
		},
		setIsTtsPlaying(val: boolean) {
			self.isTtsPlaying = val
		},
		reset() {
			self.cursorPosition = 0
			self.intendedCursorPosition = null
			self.showContextMenu = false
			self.selectedMenuIndex = -1
			self.selectedType = null
			self.searchQuery = ""
			self.searchLoading = false
			self.searchRequestId = ""
			self.isMouseDownOnMenu = false
			self.justDeletedSpaceAfterMention = false
			self.isDraggingOver = false
			self.isFocused = false
			self.isEnhancingPrompt = false
			self.isTtsPlaying = false
		},
	}))

export type IDynamicTextAreaStore = Instance<typeof DynamicTextAreaStore>
