import { useInput } from "ink"
import { useState, useCallback, useImperativeHandle, forwardRef, type Ref } from "react"

import { useInputHistory } from "../../hooks/input/useInputHistory.js"
import { useTerminalSize } from "../../hooks/TerminalSizeContext.js"
import { MultilineTextInput } from "../input/MultilineTextInput.js"

import type { AutocompleteItem, AutocompleteInputProps, AutocompleteInputHandle } from "./types.js"
import { useAutocompletePicker } from "./useAutocompletePicker.js"
import { usePickerStateNotifier } from "./hooks/usePickerStateNotifier.js"
import { useHistorySync } from "./hooks/useHistorySync.js"
import { getLastLine } from "./utils.js"

/**
 * Inner component implementation
 */
function AutocompleteInputInner<T extends AutocompleteItem>(
	{
		placeholder = "Type your message...",
		onSubmit,
		isActive = true,
		triggers,
		onSelect,
		onPickerStateChange,
		prompt = "> ",
	}: AutocompleteInputProps<T>,
	ref: Ref<AutocompleteInputHandle<T>>,
) {
	const [inputValue, setInputValue] = useState("")
	const [inputKeyCounter, setInputKeyCounter] = useState(0)
	const { columns } = useTerminalSize()
	const [pickerState, pickerActions] = useAutocompletePicker(triggers)

	const { addEntry, historyValue, isBrowsing, resetBrowsing, history, draft, setDraft, navigateUp, navigateDown } =
		useInputHistory({
			isActive: isActive && !pickerState.isOpen,
			getCurrentInput: () => inputValue,
		})

	usePickerStateNotifier(pickerState, onPickerStateChange)
	useHistorySync(isBrowsing, historyValue, draft, inputValue, setInputValue)

	const handleChange = useCallback(
		(value: string) => {
			const lastLine = getLastLine(value)
			const result = pickerActions.handleInputChange(value, lastLine)

			const effectiveValue = result.consumedValue ?? value

			setInputValue(effectiveValue)

			if (isBrowsing) {
				resetBrowsing(effectiveValue)
			} else {
				setDraft(effectiveValue)
			}
		},
		[pickerActions, isBrowsing, setDraft, getLastLine, resetBrowsing],
	)

	const handleItemSelect = useCallback(
		(item: T) => {
			const lastLine = getLastLine(inputValue)
			const newValue = pickerActions.handleSelect(item, inputValue, lastLine)

			setInputValue(newValue)
			setDraft(newValue)
			setInputKeyCounter((c) => c + 1)

			onSelect?.(item)
		},
		[inputValue, pickerActions, setDraft, getLastLine, onSelect],
	)

	const handleSubmit = useCallback(
		async (text: string) => {
			const trimmed = text.trim()

			if (!trimmed || pickerState.isOpen) {
				return
			}

			await addEntry(trimmed)

			resetBrowsing("")
			setInputValue("")

			onSubmit(trimmed)
		},
		[pickerState.isOpen, addEntry, resetBrowsing, onSubmit],
	)

	const handleEscape = useCallback(() => {
		if (pickerState.isOpen) {
			pickerActions.handleClose()
			return
		}

		setInputValue("")
		setDraft("")
		resetBrowsing("")
	}, [pickerState.isOpen, pickerActions, setDraft, resetBrowsing])

	// Handle picker selection with Enter or Tab
	useInput(
		(_input, key) => {
			if (!isActive || !pickerState.isOpen) {
				return
			}

			if (key.return || key.tab) {
				const selected = pickerState.results[pickerState.selectedIndex]

				if (selected) {
					handleItemSelect(selected)
				}
			}
		},
		{ isActive: isActive && pickerState.isOpen },
	)

	// Expose handle to parent via ref
	useImperativeHandle(
		ref,
		() => ({
			pickerState,
			handleItemSelect,
			handleIndexChange: pickerActions.handleIndexChange,
			closePicker: pickerActions.handleClose,
			refreshSearch: pickerActions.forceRefresh,
		}),
		[
			pickerState,
			handleItemSelect,
			pickerActions.handleIndexChange,
			pickerActions.handleClose,
			pickerActions.forceRefresh,
		],
	)

	return (
		<MultilineTextInput
			key={`autocomplete-input-${history.length}-${inputKeyCounter}`}
			value={inputValue}
			onChange={handleChange}
			onSubmit={handleSubmit}
			onEscape={handleEscape}
			onUpAtFirstLine={navigateUp}
			onDownAtLastLine={navigateDown}
			placeholder={placeholder}
			isActive={isActive}
			showCursor={true}
			prompt={prompt}
			columns={columns}
		/>
	)
}

/**
 * A multiline text input with autocomplete support.
 *
 * Features:
 * - Multiline text editing with history
 * - Trigger-based autocomplete (e.g., @ for files, / for commands)
 * - Keyboard navigation in picker
 * - Exposes picker state via ref for external picker rendering
 *
 * @template T - The type of autocomplete items
 *
 * @example
 * ```tsx
 * const inputRef = useRef<AutocompleteInputHandle<MyItem>>(null)
 *
 * <AutocompleteInput
 *   ref={inputRef}
 *   triggers={myTriggers}
 *   onSubmit={handleSubmit}
 *   onPickerStateChange={(state) => setPickerState(state)}
 * />
 *
 * {pickerState.isOpen && (
 *   <PickerSelect
 *     results={pickerState.results}
 *     selectedIndex={pickerState.selectedIndex}
 *     onSelect={inputRef.current?.handleItemSelect}
 *     // ...
 *   />
 * )}
 * ```
 */
export const AutocompleteInput = forwardRef(AutocompleteInputInner) as <T extends AutocompleteItem>(
	props: AutocompleteInputProps<T> & { ref?: Ref<AutocompleteInputHandle<T>> },
) => ReturnType<typeof AutocompleteInputInner>
