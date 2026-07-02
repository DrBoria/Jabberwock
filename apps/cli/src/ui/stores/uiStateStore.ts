import { makeAutoObservable } from "mobx"
import type { AutocompletePickerState } from "../components/autocomplete/types.js"

/**
 * UI-specific state that doesn't need to persist across task switches.
 * This separates UI state from task/message state in the main CLI store.
 */
export class UIStateStore {
	/** Exit handling state */
	showExitHint = false
	pendingExit = false

	/** Countdown timer for auto-accepting followup questions */
	countdownSeconds: number | null = null

	/** Custom input mode for followup questions */
	showCustomInput = false
	isTransitioningToCustomInput = false

	/** Focus management for scroll area vs input */
	manualFocus: "scroll" | "input" | null = null

	/** TODO viewer overlay */
	showTodoViewer = false

	/** Autocomplete picker state */
	pickerState: AutocompletePickerState = {
		activeTrigger: null,
		results: [],
		selectedIndex: 0,
		isOpen: false,
		isLoading: false,
		triggerInfo: null,
	}

	constructor() {
		makeAutoObservable(this)
	}

	setShowExitHint(show: boolean): void {
		this.showExitHint = show
	}

	setPendingExit(pending: boolean): void {
		this.pendingExit = pending
	}

	setCountdownSeconds(seconds: number | null): void {
		this.countdownSeconds = seconds
	}

	setShowCustomInput(show: boolean): void {
		this.showCustomInput = show
	}

	setIsTransitioningToCustomInput(transitioning: boolean): void {
		this.isTransitioningToCustomInput = transitioning
	}

	setManualFocus(focus: "scroll" | "input" | null): void {
		this.manualFocus = focus
	}

	setShowTodoViewer(show: boolean): void {
		this.showTodoViewer = show
	}

	setPickerState(state: AutocompletePickerState): void {
		this.pickerState = state
	}

	resetUIState(): void {
		this.showExitHint = false
		this.pendingExit = false
		this.countdownSeconds = null
		this.showCustomInput = false
		this.isTransitioningToCustomInput = false
		this.manualFocus = null
		this.showTodoViewer = false
		this.pickerState = {
			activeTrigger: null,
			results: [],
			selectedIndex: 0,
			isOpen: false,
			isLoading: false,
			triggerInfo: null,
		}
	}
}

export const uiStateStore = new UIStateStore()

/**
 * Hook to access the UI state store.
 * Components using this must be wrapped with observer() from mobx-react-lite.
 */
export function useUIStateStore(): UIStateStore {
	return uiStateStore
}
