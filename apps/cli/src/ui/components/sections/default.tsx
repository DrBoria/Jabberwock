import { Box, Text } from "ink"

import * as theme from "../../theme.js"
import type {
	AutocompleteItem,
	AutocompleteInputHandle,
	AutocompleteTrigger,
	AutocompletePickerState,
} from "../autocomplete/index.js"
import type { TodoItem } from "@jabberwock/types"
import { AutocompleteInput } from "../autocomplete/index.js"
import { HorizontalLine } from "../display/HorizontalLine.js"
import TodoDisplay from "../chat/todo-display.js"
import { PickerPanel, PICKER_HEIGHT, type PickerPanelState } from "./picker-panel.js"

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
	pickerState: PickerPanelState
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
				<PickerPanel
					pickerState={pickerState}
					handlePickerSelect={handlePickerSelect}
					handlePickerClose={handlePickerClose}
					handlePickerIndexChange={handlePickerIndexChange}
					isInputAreaActive={isInputAreaActive}
				/>
			) : (
				<Box height={1}>{statusBarMessage}</Box>
			)}
		</Box>
	)
}
