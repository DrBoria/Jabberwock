import { types, Instance, cast } from "mobx-state-tree"
import { ContextMenuOptionType, type SearchResult, type ContextMenuQueryItem } from "./utils/context-mentions"

/**
 * DynamicTextAreaStore — manages local state for the DynamicTextArea component.
 * This includes cursor position, context menu state, search state, and other
 * UI-level concerns that don't belong in the global ChatUIStore.
 */

export const DynamicTextAreaStore = types
	.model("DynamicTextAreaStore", {
		// ── Cursor / selection ──
		cursorPosition: types.number,
		intendedCursorPosition: types.number,

		// ── Context menu ──
		showContextMenu: types.boolean,
		selectedMenuIndex: types.number,
		selectedType: types.frozen<ContextMenuOptionType>(),
		searchQuery: types.string,
		searchLoading: types.boolean,
		searchRequestId: types.string,
		isMouseDownOnMenu: types.boolean,
		justDeletedSpaceAfterMention: types.boolean,

		// ── Drag / focus ──
		isDraggingOver: types.boolean,
		isFocused: types.boolean,
		showDropdown: types.boolean,

		// ── Search results ──
		gitCommits: types.array(types.frozen<ContextMenuQueryItem>()),
		fileSearchResults: types.array(types.frozen<SearchResult>()),

		// ── Enhancement ──
		isEnhancingPrompt: types.boolean,

		// ── TTS ──
		isTtsPlaying: types.boolean,

		// ── Sizing ──
		textAreaBaseHeight: types.number,
	})
	.actions((self) => ({
		// ── Cursor / selection actions ──
		setCursorPosition(pos: number) {
			self.cursorPosition = pos
		},
		setIntendedCursorPosition(pos: number) {
			self.intendedCursorPosition = pos
		},

		// ── Context menu actions ──
		setShowContextMenu(val: boolean) {
			self.showContextMenu = val
		},
		setSelectedMenuIndex(index: number) {
			self.selectedMenuIndex = index
		},
		setSelectedType(type: ContextMenuOptionType) {
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

		// ── Drag / focus actions ──
		setIsDraggingOver(val: boolean) {
			self.isDraggingOver = val
		},
		setIsFocused(val: boolean) {
			self.isFocused = val
		},
		setShowDropdown(val: boolean) {
			self.showDropdown = val
		},
		setGitCommits(commits: ContextMenuQueryItem[]) {
			self.gitCommits = cast(commits)
		},
		setFileSearchResults(results: SearchResult[]) {
			self.fileSearchResults = cast(results)
		},
		setTextAreaBaseHeight(height: number) {
			self.textAreaBaseHeight = height
		},
		setIsEnhancingPrompt(val: boolean) {
			self.isEnhancingPrompt = val
		},
		setIsTtsPlaying(val: boolean) {
			self.isTtsPlaying = val
		},
		reset() {
			self.cursorPosition = 0
			self.intendedCursorPosition = -1
			self.showContextMenu = false
			self.selectedMenuIndex = -1
			self.selectedType = ContextMenuOptionType.None
			self.searchQuery = ""
			self.searchLoading = false
			self.searchRequestId = ""
			self.isMouseDownOnMenu = false
			self.justDeletedSpaceAfterMention = false
			self.isDraggingOver = false
			self.isFocused = false
			self.showDropdown = false
			self.gitCommits = cast([])
			self.fileSearchResults = cast([])
			self.textAreaBaseHeight = -1
			self.isEnhancingPrompt = false
			self.isTtsPlaying = false
		},
	}))

export type IDynamicTextAreaStore = Instance<typeof DynamicTextAreaStore>

// ── Action factory for ChatStore composition ──────────────────────────

import { vscode } from "@jabberwock/devtool/webview"
import type { WebviewMessage } from "@jabberwock/types"
import { eventConstants } from "@jabberwock/types"

/**
 * Creates text-area related actions for the ChatStore.
 * These handle image selection, file search, prompt enhancement, etc.
 */
export function createTextAreaActions(_self: unknown) {
	return {
		// ── Select images ──────────────────────────────────────────
		selectImages() {
			vscode.postMessage({
				type: eventConstants.CHAT.TEXT_AREA.SELECT_IMAGES,
			} satisfies WebviewMessage)
		},

		// ── Search files ───────────────────────────────────────────
		searchFiles(query: string, requestId: string) {
			vscode.postMessage({
				type: eventConstants.CHAT.TEXT_AREA.SEARCH_FILES,
				query,
				requestId,
			} satisfies WebviewMessage)
		},

		// ── Dragged images ─────────────────────────────────────────
		draggedImages(dataUrls: string[]) {
			vscode.postMessage({
				type: eventConstants.CHAT.TEXT_AREA.DRAGGED_IMAGES,
				dataUrls,
			} satisfies WebviewMessage)
		},

		// ── Enhance prompt ─────────────────────────────────────────
		enhancePrompt(text: string) {
			vscode.postMessage({
				type: eventConstants.CHAT.TEXT_AREA.ENHANCE_PROMPT,
				text,
			} satisfies WebviewMessage)
		},

		// ── Select images for edit ─────────────────────────────────
		selectImagesForEdit(context: string, messageTs: number) {
			vscode.postMessage({
				type: eventConstants.CHAT.TEXT_AREA.SELECT_IMAGES,
				context,
				messageTs,
			} satisfies WebviewMessage)
		},
	}
}
