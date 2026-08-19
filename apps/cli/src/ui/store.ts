import { makeAutoObservable } from "mobx"

import type { TokenUsage, ProviderSettings, TodoItem } from "@jabberwock/types"

import type { TUIMessage, PendingAsk, TaskHistoryItem } from "./types.js"
import type { FileResult, SlashCommandResult, ModeResult } from "./components/autocomplete/index.js"
import type { RouterModels } from "./stores/storeTypes.js"
import { shallowArrayEqual } from "./stores/storeUtils.js"
import { addMessage, updateMessage } from "./stores/messageActions.js"

/**
 * CLI application state managed via MobX.
 *
 * Note: Autocomplete picker UI state (isOpen, selectedIndex) is now managed
 * by the useAutocompletePicker hook. The store only holds data that needs
 * to be shared between components or persisted (like search results from API).
 */
export class CLIStore {
	// Message history
	messages: TUIMessage[] = []
	pendingAsk: PendingAsk | null = null

	// Task state
	isLoading = false
	isComplete = false
	hasStartedTask = false
	error: string | null = null
	isResumingTask = false

	// Autocomplete data (from API/extension)
	fileSearchResults: FileResult[] = []
	allSlashCommands: SlashCommandResult[] = []
	availableModes: ModeResult[] = []

	// Task history (for resuming previous tasks)
	taskHistory: TaskHistoryItem[] = []

	// Current task ID (for detecting same-task reselection)
	currentTaskId: string | null = null

	// Current mode (updated reactively when mode changes)
	currentMode: string | null = null

	// Token usage metrics (from getApiMetrics)
	tokenUsage: TokenUsage | null = null

	// Model info for context window lookup
	routerModels: RouterModels | null = null
	apiConfiguration: ProviderSettings | null = null

	// Todo list tracking
	currentTodos: TodoItem[] = []
	previousTodos: TodoItem[] = []

	constructor() {
		makeAutoObservable(this)
	}

	// ---- Message actions ----

	addMessage(msg: TUIMessage): void {
		addMessage(
			this.messages,
			(msgs) => {
				this.messages = msgs
			},
			msg,
		)
	}

	updateMessage(id: string, content: string, partial?: boolean): void {
		updateMessage(
			this.messages,
			(msgs) => {
				this.messages = msgs
			},
			id,
			content,
			partial,
		)
	}

	// ---- Task actions ----

	reset(): void {
		this.messages = []
		this.pendingAsk = null
		this.isLoading = false
		this.isComplete = false
		this.hasStartedTask = false
		this.error = null
		this.isResumingTask = false
		this.fileSearchResults = []
		this.allSlashCommands = []
		this.availableModes = []
		this.taskHistory = []
		this.currentTaskId = null
		this.currentMode = null
		this.tokenUsage = null
		this.routerModels = null
		this.apiConfiguration = null
		this.currentTodos = []
		this.previousTodos = []
	}

	/** Reset for task switching - preserves global state (taskHistory, modes, commands) */
	resetForTaskSwitch(): void {
		this.messages = []
		this.pendingAsk = null
		this.isLoading = false
		this.isComplete = false
		this.hasStartedTask = false
		this.error = null
		this.isResumingTask = false
		this.tokenUsage = null
		this.currentTodos = []
		this.previousTodos = []
	}

	// ---- Autocomplete data actions ----

	setFileSearchResults(results: FileResult[]): void {
		if (!shallowArrayEqual(this.fileSearchResults, results)) {
			this.fileSearchResults = results
		}
	}

	setAllSlashCommands(commands: SlashCommandResult[]): void {
		if (!shallowArrayEqual(this.allSlashCommands, commands)) {
			this.allSlashCommands = commands
		}
	}

	setAvailableModes(modes: ModeResult[]): void {
		if (!shallowArrayEqual(this.availableModes, modes)) {
			this.availableModes = modes
		}
	}

	// ---- Task history action ----

	setTaskHistory(history: TaskHistoryItem[]): void {
		if (!shallowArrayEqual(this.taskHistory, history)) {
			this.taskHistory = history
		}
	}

	// ---- Todo actions ----

	setTodos(todos: TodoItem[]): void {
		this.previousTodos = this.currentTodos
		this.currentTodos = todos
	}
}

export const cliStore = new CLIStore()

/**
 * Hook to access the CLI store.
 * Components using this must be wrapped with observer() from mobx-react-lite
 * for reactive updates.
 */
export function useCLIStore(): CLIStore {
	return cliStore
}
