import { useEffect, useCallback, useRef, useMemo } from "react"

import { getGlobalCommandsForAutocomplete } from "@/lib/utils/commands.js"
import { arePathsEqual } from "@/lib/utils/path.js"

import { cliStore } from "../../store.js"
import { uiStateStore } from "../../stores/uiStateStore.js"
import type { WebviewMessage } from "@jabberwock/types"
import type {
	AutocompleteInputHandle,
	AutocompleteTrigger,
	AutocompleteItem,
} from "../../components/autocomplete/index.js"
import {
	createFileTrigger,
	createSlashCommandTrigger,
	createModeTrigger,
	createHelpTrigger,
	createHistoryTrigger,
	toFileResult,
	toSlashCommandResult,
	toModeResult,
	toHistoryResult,
} from "../../components/autocomplete/index.js"

interface UseAutocompleteTriggersOptions {
	autocompleteRef: React.RefObject<AutocompleteInputHandle<AutocompleteItem>>
	followupAutocompleteRef: React.RefObject<AutocompleteInputHandle<AutocompleteItem>>
	sendToExtension: ((message: WebviewMessage) => void) | null
	workspacePath: string
}

export function useAutocompleteTriggers({
	autocompleteRef,
	followupAutocompleteRef,
	sendToExtension,
	workspacePath,
}: UseAutocompleteTriggersOptions): AutocompleteTrigger<AutocompleteItem>[] {
	const fileSearchResults = cliStore.fileSearchResults
	const allSlashCommands = cliStore.allSlashCommands
	const availableModes = cliStore.availableModes
	const taskHistory = cliStore.taskHistory

	// Stable refs for autocomplete data - prevents useMemo from recreating triggers on every data change
	const fileSearchResultsRef = useRef(fileSearchResults)
	const allSlashCommandsRef = useRef(allSlashCommands)
	const availableModesRef = useRef(availableModes)
	const taskHistoryRef = useRef(taskHistory)

	// Keep refs in sync with current state
	useEffect(() => {
		fileSearchResultsRef.current = fileSearchResults
	}, [fileSearchResults])
	useEffect(() => {
		allSlashCommandsRef.current = allSlashCommands
	}, [allSlashCommands])
	useEffect(() => {
		availableModesRef.current = availableModes
	}, [availableModes])
	useEffect(() => {
		taskHistoryRef.current = taskHistory
	}, [taskHistory])

	// File search handler for the file trigger
	const handleFileSearch = useCallback(
		(query: string) => {
			if (!sendToExtension) {
				return
			}
			sendToExtension({ type: "searchFiles", query })
		},
		[sendToExtension],
	)

	// Create autocomplete triggers
	// Using refs to avoid recreating triggers every time data changes.
	// The getResults/getCommands/getModes/getHistory callbacks always read from refs to get fresh data.
	const autocompleteTriggers = useMemo((): AutocompleteTrigger<AutocompleteItem>[] => {
		const fileTrigger = createFileTrigger({
			onSearch: handleFileSearch,
			getResults: () => {
				const results = fileSearchResultsRef.current
				return results.map(toFileResult)
			},
		})

		const slashCommandTrigger = createSlashCommandTrigger({
			getCommands: () => {
				const extensionCommands = allSlashCommandsRef.current.map(toSlashCommandResult)
				const globalCommands = getGlobalCommandsForAutocomplete().map(toSlashCommandResult)
				return [...globalCommands, ...extensionCommands]
			},
		})

		const modeTrigger = createModeTrigger({
			getModes: () => availableModesRef.current.map(toModeResult),
		})

		const helpTrigger = createHelpTrigger()

		const historyTrigger = createHistoryTrigger({
			getHistory: () => {
				const history = taskHistoryRef.current
				const filtered = history.filter((item) => arePathsEqual(item.workspace, workspacePath))
				return filtered.map(toHistoryResult)
			},
		})

		return [
			fileTrigger,
			slashCommandTrigger,
			modeTrigger,
			helpTrigger,
			historyTrigger,
		] as unknown as AutocompleteTrigger<AutocompleteItem>[]
	}, [handleFileSearch, workspacePath])

	// Refresh search results when fileSearchResults changes while file picker is open
	// This handles the async timing where API results arrive after initial search
	const prevFileSearchResultsRef = useRef(fileSearchResults)
	const pickerState = uiStateStore.pickerState
	const pickerStateRef = useRef(pickerState)
	pickerStateRef.current = pickerState

	useEffect(() => {
		if (fileSearchResults === prevFileSearchResultsRef.current) {
			return
		}

		const currentPickerState = pickerStateRef.current
		const willRefresh =
			currentPickerState.isOpen && currentPickerState.activeTrigger?.id === "file" && fileSearchResults.length > 0

		prevFileSearchResultsRef.current = fileSearchResults

		if (willRefresh) {
			autocompleteRef.current?.refreshSearch()
			followupAutocompleteRef.current?.refreshSearch()
		}
	}, [fileSearchResults, autocompleteRef, followupAutocompleteRef])

	return autocompleteTriggers
}
