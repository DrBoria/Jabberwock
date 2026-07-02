import { useState, useCallback, useRef, useEffect } from "react"

import type {
	AutocompleteItem,
	AutocompletePickerState,
	AutocompletePickerActions,
	AutocompleteTrigger,
} from "./types.js"

import {
	detectActiveTrigger,
	getCachedResults,
	closePickerState,
	openPickerState,
	isSameTrigger,
	shouldSkipUpdate,
	setPickerResults,
	DEFAULT_DEBOUNCE_MS,
} from "./autocompletePickerHelpers.js"

export function useAutocompletePicker<T extends AutocompleteItem>(
	triggers: AutocompleteTrigger<T>[],
): [AutocompletePickerState<T>, AutocompletePickerActions<T>] {
	const [state, setState] = useState<AutocompletePickerState<T>>({
		activeTrigger: null,
		results: [],
		selectedIndex: 0,
		isOpen: false,
		isLoading: false,
		triggerInfo: null,
	})

	const debounceTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
	const lastQueriesRef = useRef<Map<string, string>>(new Map())

	useEffect(() => {
		return () => {
			debounceTimersRef.current.forEach((timer) => clearTimeout(timer))
		}
	}, [])

	const getLastLine = useCallback((value: string): string => {
		const lines = value.split("\n")
		return lines[lines.length - 1] || ""
	}, [])

	const getConsumedValue = useCallback((value: string, lastLine: string, triggerIndex: number): string => {
		const lines = value.split("\n")
		const lastLineIndex = lines.length - 1
		const newLastLine = lastLine.slice(0, triggerIndex) + lastLine.slice(triggerIndex + 1)
		lines[lastLineIndex] = newLastLine
		return lines.join("\n")
	}, [])

	const handleInputChange = useCallback(
		(value: string, lineText?: string): { consumedValue?: string } => {
			const lastLine = lineText ?? getLastLine(value)
			const found = detectActiveTrigger(triggers, lastLine)
			if (!found) {
				if (state.isOpen) {
					setState(closePickerState())
				}
				return {}
			}

			const { trigger: foundTrigger, info: foundTriggerInfo } = found
			const { query } = foundTriggerInfo
			const debounceMs = foundTrigger.debounceMs ?? DEFAULT_DEBOUNCE_MS
			const existingTimer = debounceTimersRef.current.get(foundTrigger.id)
			if (existingTimer) {
				clearTimeout(existingTimer)
			}

			const lastQuery = lastQueriesRef.current.get(foundTrigger.id)
			if (shouldSkipUpdate(query, lastQuery, state, foundTrigger.id)) {
				if (foundTrigger.consumeTrigger) {
					return { consumedValue: getConsumedValue(value, lastLine, foundTriggerInfo.triggerIndex) }
				}
				return {}
			}

			const isAsyncTrigger = !!foundTrigger.refreshResults
			const cachedResults = isAsyncTrigger ? getCachedResults(foundTrigger, query) : []
			setState(openPickerState(foundTrigger, foundTriggerInfo, cachedResults))

			const timer = setTimeout(async () => {
				lastQueriesRef.current.set(foundTrigger.id, query)
				try {
					const results = await foundTrigger.search(query)
					setState((prev) => {
						if (!isSameTrigger(prev, foundTrigger.id)) {
							return prev
						}
						if (isAsyncTrigger && results.length === 0) {
							return prev
						}
						return { ...prev, results, selectedIndex: 0, isOpen: true, isLoading: false }
					})
				} catch {
					setState((prev) => ({ ...prev, results: [], isOpen: false, isLoading: false }))
				}
			}, debounceMs)

			debounceTimersRef.current.set(foundTrigger.id, timer)
			if (foundTrigger.consumeTrigger) {
				return { consumedValue: getConsumedValue(value, lastLine, foundTriggerInfo.triggerIndex) }
			}
			return {}
		},
		[triggers, state.isOpen, state.activeTrigger?.id, getLastLine, getConsumedValue],
	)

	const handleSelect = useCallback(
		(item: T, fullValue: string, lineText?: string): string => {
			const { activeTrigger, triggerInfo } = state
			if (!activeTrigger || !triggerInfo) {
				return fullValue
			}
			const lines = fullValue.split("\n")
			const lastLineIndex = lines.length - 1
			const lastLine = lineText ?? lines[lastLineIndex] ?? ""
			lines[lastLineIndex] = activeTrigger.getReplacementText(item, lastLine, triggerInfo.triggerIndex)
			lastQueriesRef.current.delete(activeTrigger.id)
			setState({
				activeTrigger: null,
				results: [],
				selectedIndex: 0,
				isOpen: false,
				isLoading: false,
				triggerInfo: null,
			})
			return lines.join("\n")
		},
		[state],
	)

	const handleClose = useCallback(() => {
		debounceTimersRef.current.forEach((timer) => clearTimeout(timer))
		debounceTimersRef.current.clear()
		setState({
			activeTrigger: null,
			results: [],
			selectedIndex: 0,
			isOpen: false,
			isLoading: false,
			triggerInfo: null,
		})
	}, [])

	const handleIndexChange = useCallback((index: number) => {
		setState((prev) => ({ ...prev, selectedIndex: index }))
	}, [])

	const navigateUp = useCallback(() => {
		setState((prev) => {
			if (prev.results.length === 0) return prev
			return { ...prev, selectedIndex: prev.selectedIndex > 0 ? prev.selectedIndex - 1 : prev.results.length - 1 }
		})
	}, [])

	const navigateDown = useCallback(() => {
		setState((prev) => {
			if (prev.results.length === 0) return prev
			return { ...prev, selectedIndex: prev.selectedIndex < prev.results.length - 1 ? prev.selectedIndex + 1 : 0 }
		})
	}, [])

	const forceRefresh = useCallback(() => {
		const { activeTrigger, triggerInfo } = state
		if (!activeTrigger || !triggerInfo) {
			return
		}
		const currentTrigger = triggers.find((t) => t.id === activeTrigger.id)
		if (!currentTrigger) {
			return
		}
		const { query } = triggerInfo
		const refreshFn = currentTrigger.refreshResults ?? currentTrigger.search
		try {
			const results = refreshFn(query)
			if (results instanceof Promise) {
				results.then((asyncResults) => {
					setState((prev) => setPickerResults(prev, activeTrigger.id, asyncResults, false))
				})
			} else {
				setState((prev) => setPickerResults(prev, activeTrigger.id, results, false))
			}
		} catch {
			/* noop */
		}
	}, [state, triggers])

	const actions: AutocompletePickerActions<T> = {
		handleInputChange,
		handleSelect,
		handleClose,
		handleIndexChange,
		navigateUp,
		navigateDown,
		forceRefresh,
	}

	return [state, actions]
}
