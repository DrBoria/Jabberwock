import { Box, Text } from "ink"
import { Select } from "@inkjs/ui"

import * as theme from "../../theme.js"
import { uiStateStore } from "../../store.js"
import type {
	AutocompleteItem,
	AutocompleteInputHandle,
	AutocompleteTrigger,
	AutocompletePickerState,
} from "../autocomplete/index.js"
import { AutocompleteInput } from "../autocomplete/index.js"
import { HorizontalLine } from "../display/HorizontalLine.js"
import { PickerPanel, type PickerPanelState } from "./picker-panel.js"

interface FollowupSuggestionsProps {
	pendingAsk: { type: "followup"; content: string; suggestions: { answer: string }[] }
	countdownSeconds: number | null
	showCustomInput: boolean
	onSelect: (value: string) => void
}

export function FollowupSuggestions({
	pendingAsk,
	countdownSeconds,
	showCustomInput,
	onSelect,
}: FollowupSuggestionsProps) {
	return (
		<Box flexDirection="column">
			<Text color={theme.jabberwockHeader}>{pendingAsk.content}</Text>
			{pendingAsk.suggestions && pendingAsk.suggestions.length > 0 && !showCustomInput ? (
				<Box flexDirection="column" marginTop={1}>
					<HorizontalLine active={true} />
					<Select
						options={[
							...pendingAsk.suggestions.map((s) => ({
								label: s.answer,
								value: s.answer,
							})),
							{ label: "Type something...", value: "__CUSTOM__" },
						]}
						onChange={onSelect}
					/>
					<HorizontalLine active={true} />
					<Text color={theme.dimText}>
						↑↓ navigate • Enter select
						{countdownSeconds !== null && <Text color="yellow"> • Auto-select in {countdownSeconds}s</Text>}
					</Text>
				</Box>
			) : null}
		</Box>
	)
}

interface FollowupCustomInputProps {
	followupAutocompleteRef: React.RefObject<AutocompleteInputHandle<AutocompleteItem>>
	autocompleteTriggers: AutocompleteTrigger<AutocompleteItem>[]
	handlePickerStateChange: (state: AutocompletePickerState) => void
	handleSubmit: (text: string) => void
	setIsTransitioningToCustomInput: (val: boolean) => void
	isInputAreaActive: boolean
	statusBarMessage: React.ReactNode
	pickerState: PickerPanelState
	handlePickerSelect: (item: AutocompleteItem) => void
	handlePickerClose: () => void
	handlePickerIndexChange: (index: number) => void
}

export function FollowupCustomInput({
	followupAutocompleteRef,
	autocompleteTriggers,
	handlePickerStateChange,
	handleSubmit,
	setIsTransitioningToCustomInput,
	isInputAreaActive,
	statusBarMessage,
	pickerState,
	handlePickerSelect,
	handlePickerClose,
	handlePickerIndexChange,
}: FollowupCustomInputProps) {
	return (
		<Box flexDirection="column" marginTop={1}>
			<HorizontalLine active={isInputAreaActive} />
			<AutocompleteInput
				ref={followupAutocompleteRef}
				placeholder="Type your response..."
				onSubmit={(text: string) => {
					if (text && text.trim()) {
						handleSubmit(text)
						uiStateStore.setShowCustomInput(false)
						setIsTransitioningToCustomInput(false)
					}
				}}
				isActive={true}
				triggers={autocompleteTriggers}
				onPickerStateChange={handlePickerStateChange}
				prompt="> "
			/>
			<HorizontalLine active={isInputAreaActive} />
			{pickerState.isOpen ? (
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

interface ApprovalPromptProps {
	pendingAsk: { type: string; content: string }
	statusBarMessage: React.ReactNode
}

export function ApprovalPrompt({ pendingAsk, statusBarMessage }: ApprovalPromptProps) {
	return (
		<Box flexDirection="column">
			<Text color={theme.jabberwockHeader}>{pendingAsk.content}</Text>
			<Text color={theme.dimText}>
				Press <Text color={theme.successColor}>Y</Text> to approve, <Text color={theme.errorColor}>N</Text> to
				reject
			</Text>
			<Box height={1}>{statusBarMessage}</Box>
		</Box>
	)
}
