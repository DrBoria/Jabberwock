import { useCallback } from "react"
import type { WebviewMessage } from "@jabberwock/types"

import type {
	AutocompletePickerState,
	AutocompleteInputHandle,
	AutocompleteItem,
	ModeResult,
	HistoryResult,
} from "../../components/autocomplete/index.js"
import { useCLIStore, cliStore } from "../../store.js"
import { useUIStateStore } from "../../stores/uiStateStore.js"

export interface UsePickerHandlersOptions {
	autocompleteRef: React.RefObject<AutocompleteInputHandle>
	followupAutocompleteRef: React.RefObject<AutocompleteInputHandle>
	sendToExtension: ((msg: WebviewMessage) => void) | null
	showInfo: (msg: string, duration?: number) => void
	seenMessageIds: React.MutableRefObject<Set<string>>
	firstTextMessageSkipped: React.MutableRefObject<boolean>
}

export interface UsePickerHandlersReturn {
	handlePickerStateChange: (state: AutocompletePickerState) => void
	handlePickerSelect: (item: AutocompleteItem) => void
	handlePickerClose: () => void
	handlePickerIndexChange: (index: number) => void
}

function closeAllPickers(
	autocompleteRef: React.RefObject<AutocompleteInputHandle>,
	followupAutocompleteRef: React.RefObject<AutocompleteInputHandle>,
): void {
	autocompleteRef.current?.closePicker()
	followupAutocompleteRef.current?.closePicker()
}

function handleModeSelect(
	item: AutocompleteItem,
	pickerState: AutocompletePickerState,
	sendToExtension: ((msg: WebviewMessage) => void) | null,
	autocompleteRef: React.RefObject<AutocompleteInputHandle>,
	followupAutocompleteRef: React.RefObject<AutocompleteInputHandle>,
): void {
	const modeItem = item as ModeResult
	if (sendToExtension) {
		sendToExtension({ type: "mode", text: modeItem.slug })
	}
	closeAllPickers(autocompleteRef, followupAutocompleteRef)
}

function handleHistorySelect(
	item: AutocompleteItem,
	pickerState: AutocompletePickerState,
	sendToExtension: ((msg: WebviewMessage) => void) | null,
	autocompleteRef: React.RefObject<AutocompleteInputHandle>,
	followupAutocompleteRef: React.RefObject<AutocompleteInputHandle>,
	isLoading: boolean,
	showInfo: (msg: string, duration?: number) => void,
	currentTaskId: string | null,
	seenMessageIds: React.MutableRefObject<Set<string>>,
	firstTextMessageSkipped: React.MutableRefObject<boolean>,
): void {
	const historyItem = item as HistoryResult

	if (isLoading) {
		showInfo("Cannot switch tasks while task is in progress", 2000)
		closeAllPickers(autocompleteRef, followupAutocompleteRef)
		return
	}

	if (historyItem.id === currentTaskId) {
		closeAllPickers(autocompleteRef, followupAutocompleteRef)
		return
	}

	if (sendToExtension) {
		cliStore.resetForTaskSwitch()
		cliStore.isResumingTask = true
		cliStore.currentTaskId = historyItem.id
		seenMessageIds.current.clear()
		firstTextMessageSkipped.current = false
		sendToExtension({ type: "showTaskWithId", text: historyItem.id })
	}

	closeAllPickers(autocompleteRef, followupAutocompleteRef)
}

function isModeItem(item: AutocompleteItem, pickerState: AutocompletePickerState): boolean {
	return pickerState.activeTrigger?.id === "mode" && item !== null && typeof item === "object" && "slug" in item
}

function isHistoryItem(item: AutocompleteItem, pickerState: AutocompletePickerState): boolean {
	return pickerState.activeTrigger?.id === "history" && item !== null && typeof item === "object" && "id" in item
}

function getTriggerId(item: AutocompleteItem, pickerState: AutocompletePickerState): string | null {
	if (isModeItem(item, pickerState)) {
		return "mode"
	}
	if (isHistoryItem(item, pickerState)) {
		return "history"
	}
	return null
}

/**
 * Hook to handle autocomplete picker interactions.
 *
 * Responsibilities:
 * - Handle picker state changes from AutocompleteInput
 * - Handle item selection (special handling for modes and history items)
 * - Handle mode switching via picker
 * - Handle task switching via history picker
 * - Handle picker close and index change
 */
export function usePickerHandlers({
	autocompleteRef,
	followupAutocompleteRef,
	sendToExtension,
	showInfo,
	seenMessageIds,
	firstTextMessageSkipped,
}: UsePickerHandlersOptions): UsePickerHandlersReturn {
	const { isLoading, currentTaskId } = useCLIStore()
	const { pickerState, setPickerState } = useUIStateStore()

	const handlePickerStateChange = useCallback(
		(state: AutocompletePickerState) => {
			setPickerState(state)
		},
		[setPickerState],
	)

	const handlePickerSelect = useCallback(
		(item: AutocompleteItem) => {
			const triggerId = getTriggerId(item, pickerState)

			if (triggerId === "mode") {
				handleModeSelect(item, pickerState, sendToExtension, autocompleteRef, followupAutocompleteRef)
			} else if (triggerId === "history") {
				handleHistorySelect(
					item,
					pickerState,
					sendToExtension,
					autocompleteRef,
					followupAutocompleteRef,
					isLoading,
					showInfo,
					currentTaskId,
					seenMessageIds,
					firstTextMessageSkipped,
				)
			} else {
				autocompleteRef.current?.handleItemSelect(item)
				followupAutocompleteRef.current?.handleItemSelect(item)
			}
		},
		[
			pickerState,
			isLoading,
			showInfo,
			currentTaskId,
			sendToExtension,
			autocompleteRef,
			followupAutocompleteRef,
			seenMessageIds,
			firstTextMessageSkipped,
		],
	)

	const handlePickerClose = useCallback(() => {
		closeAllPickers(autocompleteRef, followupAutocompleteRef)
	}, [autocompleteRef, followupAutocompleteRef])

	const handlePickerIndexChange = useCallback(
		(index: number) => {
			autocompleteRef.current?.handleIndexChange(index)
			followupAutocompleteRef.current?.handleIndexChange(index)
		},
		[autocompleteRef, followupAutocompleteRef],
	)

	return {
		handlePickerStateChange,
		handlePickerSelect,
		handlePickerClose,
		handlePickerIndexChange,
	}
}
