import { makeAutoObservable } from "mobx"

import type { TokenUsage, ProviderSettings, TodoItem } from "@jabberwock/types"

import type { TUIMessage, PendingAsk, TaskHistoryItem } from "./types.js"
import type { FileResult, SlashCommandResult, ModeResult } from "./components/autocomplete/index.js"
import type { AutocompletePickerState } from "./components/autocomplete/types.js"

import { addMessage, updateMessage, shallowArrayEqual } from "./messages.js"

/**
 * RouterModels type for context window lookup.
 * Simplified version - we only need contextWindow from "ModelInfo."
 */
export type RouterModels = Record<string, Record<string, { contextWindow?: number }>>

/**
 * CLI application state managed via MobX.
 *
 * Note: Autocomplete picker UI state (isOpen, selectedIndex) is now managed
 * by the useAutocompletePicker hook. The store only holds data that needs
 * to be shared between components or persisted (like search results from "API").
 */
export function createCLIStore() {
	const store = makeAutoObservable({
		// Message history
		messages: [] as TUIMessage[],
		pendingAsk: null as PendingAsk | null,

		// Task state
		isLoading: false,
		isComplete: false,
		hasStartedTask: false,
		error: null as string | null,
		isResumingTask: false,

		// Autocomplete data (from "API/extension")
		fileSearchResults: [] as FileResult[],
		allSlashCommands: [] as SlashCommandResult[],
		availableModes: [] as ModeResult[],

		// Task history (for resuming previous tasks)
		taskHistory: [] as TaskHistoryItem[],

		// Current task ID (for detecting same-task reselection)
		currentTaskId: null as string | null,

		// Current mode (updated reactively when mode changes)
		currentMode: null as string | null,

		// Token usage metrics (from "getApiMetrics")
		tokenUsage: null as TokenUsage | null,

		// Model info for context window lookup
		routerModels: null as RouterModels | null,
		apiConfiguration: null as ProviderSettings | null,

		// Todo list tracking
		currentTodos: [] as TodoItem[],
		previousTodos: [] as TodoItem[],

		// ---- Message actions ----

		addMessage(msg: TUIMessage): void {
			addMessage(
				store.messages,
				(msgs) => {
					store.messages = msgs
				},
				msg,
			)
		},

		updateMessage(id: string, content: string, partial?: boolean): void {
			updateMessage(
				store.messages,
				(msgs) => {
					store.messages = msgs
				},
				id,
				content,
				partial,
			)
		},

		// ---- Task actions ----

		reset(): void {
			store.messages = []
			store.pendingAsk = null
			store.isLoading = false
			store.isComplete = false
			store.hasStartedTask = false
			store.error = null
			store.isResumingTask = false
			store.fileSearchResults = []
			store.allSlashCommands = []
			store.availableModes = []
			store.taskHistory = []
			store.currentTaskId = null
			store.currentMode = null
			store.tokenUsage = null
			store.routerModels = null
			store.apiConfiguration = null
			store.currentTodos = []
			store.previousTodos = []
		},

		/** Reset for task switching - preserves global state (taskHistory, modes, commands) */
		resetForTaskSwitch(): void {
			store.messages = []
			store.pendingAsk = null
			store.isLoading = false
			store.isComplete = false
			store.hasStartedTask = false
			store.error = null
			store.isResumingTask = false
			store.tokenUsage = null
			store.currentTodos = []
			store.previousTodos = []
		},

		// ---- Autocomplete data actions ----

		setFileSearchResults(results: FileResult[]): void {
			if (!shallowArrayEqual(store.fileSearchResults, results)) {
				store.fileSearchResults = results
			}
		},

		setAllSlashCommands(commands: SlashCommandResult[]): void {
			if (!shallowArrayEqual(store.allSlashCommands, commands)) {
				store.allSlashCommands = commands
			}
		},

		setAvailableModes(modes: ModeResult[]): void {
			if (!shallowArrayEqual(store.availableModes, modes)) {
				store.availableModes = modes
			}
		},

		// ---- Task history action ----

		setTaskHistory(history: TaskHistoryItem[]): void {
			if (!shallowArrayEqual(store.taskHistory, history)) {
				store.taskHistory = history
			}
		},

		// ---- Todo actions ----

		setTodos(todos: TodoItem[]): void {
			store.previousTodos = store.currentTodos
			store.currentTodos = todos
		},
	})

	return store
}

/** CLIStore instance type */
export type CLIStore = ReturnType<typeof createCLIStore>

export const cliStore = createCLIStore()

/**
 * Hook to access the CLI store.
 * Components using this must be wrapped with observer() from "mobx-react-lite"
 * for reactive updates.
 */
export function useCLIStore(): CLIStore {
	return cliStore
}

/**
 * UI-specific state that doesn't need to persist across task switches.
 * This separates UI state from "task/message" state in the main CLI store.
 */
export function createUIStateStore() {
	const store = makeAutoObservable({
		/** Exit handling state */
		showExitHint: false,
		pendingExit: false,

		/** Countdown timer for auto-accepting followup questions */
		countdownSeconds: null as number | null,

		/** Custom input mode for followup questions */
		showCustomInput: false,
		isTransitioningToCustomInput: false,

		/** Focus management for scroll area vs input */
		manualFocus: null as "scroll" | "input" | null,

		/** TODO viewer overlay */
		showTodoViewer: false,

		/** Terminal size (columns/rows) shared with components */
		terminalSize: { columns: 80, rows: 24 } as { columns: number; rows: number },

		/** Autocomplete picker state */
		pickerState: {
			activeTrigger: null,
			results: [],
			selectedIndex: 0,
			isOpen: false,
			isLoading: false,
			triggerInfo: null,
		} as AutocompletePickerState,

		setShowExitHint(show: boolean): void {
			store.showExitHint = show
		},

		setPendingExit(pending: boolean): void {
			store.pendingExit = pending
		},

		setCountdownSeconds(seconds: number | null): void {
			store.countdownSeconds = seconds
		},

		setShowCustomInput(show: boolean): void {
			store.showCustomInput = show
		},

		setIsTransitioningToCustomInput(transitioning: boolean): void {
			store.isTransitioningToCustomInput = transitioning
		},

		setManualFocus(focus: "scroll" | "input" | null): void {
			store.manualFocus = focus
		},

		setShowTodoViewer(show: boolean): void {
			store.showTodoViewer = show
		},

		setTerminalSize(size: { columns: number; rows: number }): void {
			store.terminalSize = size
		},

		setPickerState(state: AutocompletePickerState): void {
			store.pickerState = state
		},

		resetUIState(): void {
			store.showExitHint = false
			store.pendingExit = false
			store.countdownSeconds = null
			store.showCustomInput = false
			store.isTransitioningToCustomInput = false
			store.manualFocus = null
			store.showTodoViewer = false
			store.pickerState = {
				activeTrigger: null,
				results: [],
				selectedIndex: 0,
				isOpen: false,
				isLoading: false,
				triggerInfo: null,
			}
		},
	})

	return store
}

/** UIStateStore instance type */
export type UIStateStore = ReturnType<typeof createUIStateStore>

export const uiStateStore = createUIStateStore()

/**
 * Hook to access the UI state store.
 * Components using this must be wrapped with observer() from "mobx-react-lite."
 */
export function useUIStateStore(): UIStateStore {
	return uiStateStore
}
