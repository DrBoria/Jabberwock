import { useEffect, useRef } from "react"

import type { AutocompletePickerState, AutocompleteItem } from "../types.js"

/**
 * Hook that notifies parent of picker state changes only when visually relevant properties change.
 * This prevents double renders from cascading state updates.
 */
export function usePickerStateNotifier<T extends AutocompleteItem>(
	pickerState: AutocompletePickerState<T>,
	onPickerStateChange?: (state: AutocompletePickerState<T>) => void,
): void {
	const prevPickerStateRef = useRef({
		isOpen: pickerState.isOpen,
		resultsLength: pickerState.results.length,
		selectedIndex: pickerState.selectedIndex,
		isLoading: pickerState.isLoading,
	})

	useEffect(() => {
		const prev = prevPickerStateRef.current
		const curr = {
			isOpen: pickerState.isOpen,
			resultsLength: pickerState.results.length,
			selectedIndex: pickerState.selectedIndex,
			isLoading: pickerState.isLoading,
		}

		if (
			prev.isOpen !== curr.isOpen ||
			prev.resultsLength !== curr.resultsLength ||
			prev.selectedIndex !== curr.selectedIndex ||
			prev.isLoading !== curr.isLoading
		) {
			prevPickerStateRef.current = curr
			onPickerStateChange?.(pickerState)
		}
	}, [pickerState, onPickerStateChange])
}
