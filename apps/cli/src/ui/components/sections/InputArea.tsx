import { Box, Text, useInput } from "ink"
import { useCallback } from "react"
import * as theme from "../../theme.js"
import { useCLIStore } from "../../store.js"
import { useUIStateStore, uiStateStore } from "../../stores/uiStateStore.js"
import { useAutocompleteTriggers } from "../../hooks/input/useAutocompleteTriggers.js"
import type { WebviewMessage } from "@jabberwock/types"
import type { Toast } from "../../hooks/ui/useToast.js"
import type { AutocompleteItem, AutocompleteInputHandle, AutocompletePickerState } from "../autocomplete/index.js"
import LoadingText from "../display/LoadingText.js"
import ToastDisplay from "../chat/ToastDisplay.js"
import ScrollIndicator from "../display/ScrollIndicator.js"
import { FollowupSuggestions, FollowupCustomInput, ApprovalPrompt } from "./FollowupContent.js"
import DefaultInputArea from "./DefaultInputArea.js"

interface InputAreaProps {
	autocompleteRef: React.RefObject<AutocompleteInputHandle<AutocompleteItem>>
	followupAutocompleteRef: React.RefObject<AutocompleteInputHandle<AutocompleteItem>>
	sendToExtension: ((message: WebviewMessage) => void) | null
	workspacePath: string
	handleSubmit: (text: string) => void
	handleApprove: () => void
	handleReject: () => void
	cancelCountdown: () => void
	handlePickerStateChange: (state: AutocompletePickerState) => void
	handlePickerSelect: (item: AutocompleteItem) => void
	handlePickerClose: () => void
	handlePickerIndexChange: (index: number) => void
	setIsTransitioningToCustomInput: (val: boolean) => void
	currentToast: Toast | null
	view: string
	scrollTop: number
	maxScroll: number
	isScrollAreaActive: boolean
	isInputAreaActive: boolean
}

function getStatusBarMessage(
	currentToast: Toast | null,
	showExitHint: boolean,
	isLoading: boolean,
	pendingAsk: unknown,
	view: string,
	isScrollAreaActive: boolean,
	scrollTop: number,
	maxScroll: number,
	isInputAreaActive: boolean,
) {
	if (currentToast) return <ToastDisplay toast={currentToast} />
	if (showExitHint) return <Text color="yellow">Press Ctrl+C again to exit</Text>
	if (isLoading && !pendingAsk) {
		return (
			<Box>
				<LoadingText>{view === "ToolUse" ? "Using tool" : "Thinking"}</LoadingText>
				<Text color={theme.dimText}> • </Text>
				<Text color={theme.dimText}>Esc to cancel</Text>
				{isScrollAreaActive && (
					<>
						<Text color={theme.dimText}> • </Text>
						<ScrollIndicator scrollTop={scrollTop} maxScroll={maxScroll} isScrollFocused={true} />
					</>
				)}
			</Box>
		)
	}
	if (isScrollAreaActive)
		return <ScrollIndicator scrollTop={scrollTop} maxScroll={maxScroll} isScrollFocused={true} />
	if (isInputAreaActive) return <Text color={theme.dimText}>? for shortcuts</Text>
	return null
}

export default function InputArea({
	autocompleteRef,
	followupAutocompleteRef,
	sendToExtension,
	workspacePath,
	handleSubmit,
	handleApprove,
	handleReject,
	cancelCountdown,
	handlePickerStateChange,
	handlePickerSelect,
	handlePickerClose,
	handlePickerIndexChange,
	setIsTransitioningToCustomInput,
	currentToast,
	view,
	scrollTop,
	maxScroll,
	isScrollAreaActive,
	isInputAreaActive,
}: InputAreaProps) {
	const { pendingAsk, isLoading, isComplete, currentTodos } = useCLIStore()
	const { showExitHint, countdownSeconds, showCustomInput, showTodoViewer, pickerState } = useUIStateStore()
	const autocompleteTriggers = useAutocompleteTriggers({
		autocompleteRef,
		followupAutocompleteRef,
		sendToExtension,
		workspacePath,
	})
	useInput((input) => {
		if (pendingAsk && pendingAsk.type !== "followup") {
			const lower = input.toLowerCase()
			if (lower === "y") handleApprove()
			else if (lower === "n") handleReject()
		}
	})
	const showFollowupSuggestions =
		pendingAsk?.type === "followup" &&
		pendingAsk.suggestions &&
		pendingAsk.suggestions.length > 0 &&
		!showCustomInput
	useInput((_input, key) => {
		if (showFollowupSuggestions && countdownSeconds !== null && (key.upArrow || key.downArrow)) cancelCountdown()
	})
	const showApprovalPrompt = Boolean(pendingAsk && pendingAsk.type !== "followup")
	const statusBarMessage = getStatusBarMessage(
		currentToast,
		showExitHint,
		isLoading,
		pendingAsk,
		view,
		isScrollAreaActive,
		scrollTop,
		maxScroll,
		isInputAreaActive,
	)
	const handleFollowupSelect = useCallback(
		(value: string) => {
			if (!value || typeof value !== "string") return
			if (showCustomInput || uiStateStore.isTransitioningToCustomInput) return
			if (value === "__CUSTOM__") {
				cancelCountdown()
				setIsTransitioningToCustomInput(true)
				uiStateStore.setShowCustomInput(true)
			} else if (value.trim()) {
				handleSubmit(value)
			}
		},
		[showCustomInput, cancelCountdown, setIsTransitioningToCustomInput, handleSubmit],
	)

	return (
		<Box flexDirection="column" flexShrink={0}>
			{pendingAsk?.type === "followup" ? (
				<Box flexDirection="column">
					<FollowupSuggestions
						pendingAsk={
							pendingAsk as unknown as {
								type: "followup"
								content: string
								suggestions: { answer: string }[]
							}
						}
						countdownSeconds={countdownSeconds}
						showCustomInput={showCustomInput}
						onSelect={handleFollowupSelect}
					/>
					{!showFollowupSuggestions && (
						<FollowupCustomInput
							followupAutocompleteRef={followupAutocompleteRef}
							autocompleteTriggers={autocompleteTriggers}
							handlePickerStateChange={handlePickerStateChange}
							handleSubmit={handleSubmit}
							setIsTransitioningToCustomInput={setIsTransitioningToCustomInput}
							isInputAreaActive={isInputAreaActive}
							statusBarMessage={statusBarMessage}
							pickerState={pickerState}
							handlePickerSelect={handlePickerSelect}
							handlePickerClose={handlePickerClose}
							handlePickerIndexChange={handlePickerIndexChange}
						/>
					)}
				</Box>
			) : showApprovalPrompt ? (
				<ApprovalPrompt pendingAsk={pendingAsk!} statusBarMessage={statusBarMessage} />
			) : (
				<DefaultInputArea
					autocompleteRef={autocompleteRef}
					autocompleteTriggers={autocompleteTriggers}
					handlePickerStateChange={handlePickerStateChange}
					handleSubmit={handleSubmit}
					isInputAreaActive={isInputAreaActive}
					isComplete={isComplete}
					statusBarMessage={statusBarMessage}
					showTodoViewer={showTodoViewer}
					currentTodos={currentTodos}
					pickerState={pickerState}
					handlePickerSelect={handlePickerSelect}
					handlePickerClose={handlePickerClose}
					handlePickerIndexChange={handlePickerIndexChange}
				/>
			)}
		</Box>
	)
}
