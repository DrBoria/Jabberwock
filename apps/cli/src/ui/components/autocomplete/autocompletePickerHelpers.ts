import type { AutocompleteItem, AutocompletePickerState, AutocompleteTrigger, TriggerDetectionResult } from "./types.js"

export const DEFAULT_DEBOUNCE_MS = 150

export type PickerStateUpdater<T extends AutocompleteItem> = (
	prev: AutocompletePickerState<T>,
) => AutocompletePickerState<T>

export function detectActiveTrigger<T extends AutocompleteItem>(
	triggers: AutocompleteTrigger<T>[],
	lastLine: string,
): { trigger: AutocompleteTrigger<T>; info: TriggerDetectionResult } | null {
	for (const trigger of triggers) {
		const detection = trigger.detectTrigger(lastLine)
		if (detection) {
			return { trigger, info: detection }
		}
	}
	return null
}

export function getCachedResults<T extends AutocompleteItem>(trigger: AutocompleteTrigger<T>, query: string): T[] {
	if (!trigger.refreshResults) {
		return []
	}
	try {
		const cached = trigger.refreshResults(query)
		if (!(cached instanceof Promise)) {
			return cached
		}
	} catch {
		/* noop */
	}
	return []
}

export function closePickerState<T extends AutocompleteItem>(): PickerStateUpdater<T> {
	return (prev) => ({
		...prev,
		activeTrigger: null,
		results: [],
		selectedIndex: 0,
		isOpen: false,
		isLoading: false,
		triggerInfo: null,
	})
}

export function openPickerState<T extends AutocompleteItem>(
	trigger: AutocompleteTrigger<T>,
	info: TriggerDetectionResult,
	cachedResults: T[],
): PickerStateUpdater<T> {
	return (prev) => ({
		...prev,
		activeTrigger: trigger,
		isLoading: cachedResults.length === 0,
		isOpen: true,
		triggerInfo: info,
		results: cachedResults.length > 0 ? cachedResults : prev.results,
		selectedIndex: cachedResults.length > 0 ? 0 : prev.selectedIndex,
	})
}

export function isSameTrigger<T extends AutocompleteItem>(
	prev: AutocompletePickerState<T>,
	triggerId: string,
): boolean {
	return prev.activeTrigger?.id === triggerId
}

export function shouldSkipUpdate<T extends AutocompleteItem>(
	query: string,
	lastQuery: string | undefined,
	state: AutocompletePickerState<T>,
	triggerId: string,
): boolean {
	return query === lastQuery && state.isOpen && isSameTrigger(state, triggerId)
}

export function setPickerResults<T2 extends AutocompleteItem>(
	prev: AutocompletePickerState<T2>,
	triggerId: string,
	results: T2[],
	isLoading: boolean,
): AutocompletePickerState<T2> {
	if (!isSameTrigger(prev, triggerId)) {
		return prev
	}
	if (prev.results.length === results.length && prev.results.every((r, i) => r.key === results[i]?.key)) {
		return { ...prev, isLoading: false }
	}
	return {
		...prev,
		results,
		selectedIndex: prev.selectedIndex < results.length ? prev.selectedIndex : 0,
		isLoading,
	}
}
