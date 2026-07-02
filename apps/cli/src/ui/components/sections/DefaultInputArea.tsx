import { Box, Text } from "ink"

import * as theme from "../../theme.js"
import type {
	AutocompleteItem,
	AutocompleteInputHandle,
	AutocompleteTrigger,
	AutocompletePickerState,
} from "../autocomplete/index.js"
import type { TodoItem } from "@jabberwock/types"
import { AutocompleteInput, PickerSelect } from "../autocomplete/index.js"
import { HorizontalLine } from "../display/HorizontalLine.js"
import TodoDisplay from "../chat/TodoDisplay.js"

const PICKER_HEIGHT = 10

interface DefaultInputAreaProps {
	autocompleteRef: React.RefObject<AutocompleteInputHandle<AutocompleteItem>>
	autocompleteTriggers: AutocompleteTrigger<AutocompleteItem>[]
	handlePickerStateChange: (state: AutocompletePickerState) => void
	handleSubmit: (text: string) => void
	isInputAreaActive: boolean
	isComplete: boolean
	statusBarMessage: React.ReactNode
	showTodoViewer: boolean
	currentTodos: TodoItem[]
	pickerState: {
		isOpen: boolean
		results: AutocompleteItem[]
		selectedIndex: number
		activeTrigger: {
			renderItem: (item: AutocompleteItem, isSelected: boolean) => React.ReactNode
			emptyMessage?: string
		} | null
		isLoading: boolean
	}
	handlePickerSelect: (item: AutocompleteItem) => void
	handlePickerClose: () => void
	handlePickerIndexChange: (index: number) => void
}

export default function DefaultInputArea({
	autocompleteRef,
	autocompleteTriggers,
	handlePickerStateChange,
	handleSubmit,
	isInputAreaActive,
	isComplete,
	statusBarMessage,
	showTodoViewer,
	currentTodos,
	pickerState,
	handlePickerSelect,
	handlePickerClose,
	handlePickerIndexChange,
}: DefaultInputAreaProps) {
	return (
		<Box flexDirection="column">
			<HorizontalLine active={isInputAreaActive} />
			<AutocompleteInput
				ref={autocompleteRef}
				placeholder={isComplete ? "Type to continue..." : ""}
				onSubmit={handleSubmit}
				isActive={isInputAreaActive}
				triggers={autocompleteTriggers}
				onPickerStateChange={handlePickerStateChange}
				prompt="› "
			/>
			<HorizontalLine active={isInputAreaActive} />
			{showTodoViewer ? (
				<Box flexDirection="column" height={PICKER_HEIGHT}>
					<TodoDisplay todos={currentTodos} showProgress={true} title="TODO List" />
					<Box height={1}>
						<Text color={theme.dimText}>Ctrl+T to close</Text>
					</Box>
				</Box>
			) : pickerState.isOpen ? (
				<Box flexDirection="column" height={PICKER_HEIGHT}>
					<PickerSelect
						results={pickerState.results}
						selectedIndex={pickerState.selectedIndex}
						maxVisible={PICKER_HEIGHT - 1}
						onSelect={handlePickerSelect}
						onEscape={handlePickerClose}
						onIndexChange={handlePickerIndexChange}
						renderItem={
							pickerState.activeTrigger
								? pickerState.activeTrigger.renderItem
								: (item: AutocompleteItem, isSelected: boolean) => (
										<Box paddingLeft={2}>
											<Text color={isSelected ? "cyan" : undefined}>{item.key}</Text>
										</Box>
									)
						}
						emptyMessage={pickerState.activeTrigger?.emptyMessage}
						isActive={isInputAreaActive && pickerState.isOpen}
						isLoading={pickerState.isLoading}
					/>
				</Box>
			) : (
				<Box height={1}>{statusBarMessage}</Box>
			)}
		</Box>
	)
}
