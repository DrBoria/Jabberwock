import { observer } from "mobx-react-lite"
import { Box, Text, useApp } from "ink"
import { useRef, useMemo } from "react"
import type { ExtensionHostInterface, ExtensionHostOptions } from "@/agent/index.js"
import { getContextWindow } from "@/lib/utils/env/context-window.js"
import { useCLIStore } from "./store.js"
import { useUIStateStore, uiStateStore } from "./stores/uiStateStore.js"
import {
	TerminalSizeProvider,
	useTerminalSize,
	useToast,
	useExtensionHost,
	useMessageHandlers,
	useTaskSubmit,
	useGlobalInput,
	useFollowupCountdown,
	useFocusManagement,
	usePickerHandlers,
} from "./hooks/index.js"
import { useScrollState } from "./hooks/useScrollState.js"
import { getView } from "./utils/index.js"
import Header from "./components/display/Header.js"
import ChatHistoryItem from "./components/chat/ChatHistoryItem.js"
import InputArea from "./components/sections/InputArea.js"
import { ScrollArea } from "./components/scroll/ScrollArea.js"

export interface TUIAppProps extends ExtensionHostOptions {
	initialPrompt?: string
	initialTaskId?: string
	initialSessionId?: string
	continueSession?: boolean
	version: string
	createExtensionHost: (options: ExtensionHostOptions) => ExtensionHostInterface
}

const AppInner = observer(function AppInner({ createExtensionHost, ...extensionHostOptions }: TUIAppProps) {
	const {
		initialPrompt,
		initialTaskId,
		initialSessionId,
		continueSession,
		workspacePath,
		extensionPath,
		user,
		provider,
		apiKey,
		model,
		mode,
		nonInteractive = false,
		debug,
		exitOnComplete,
		reasoningEffort,
		ephemeral,
		version,
	} = extensionHostOptions
	const { exit } = useApp()
	const {
		messages,
		pendingAsk,
		isLoading,
		isComplete: _isComplete,
		error,
		availableModes,
		currentMode,
		tokenUsage,
		routerModels,
		apiConfiguration,
	} = useCLIStore()
	const { pickerState } = useUIStateStore()
	const contextWindow = useMemo(
		() => getContextWindow(routerModels, apiConfiguration),
		[routerModels, apiConfiguration],
	)
	const autocompleteRef = useRef(null)
	const followupAutocompleteRef = useRef(null)
	const { rows } = useTerminalSize()
	const { scrollState, scrollToBottomTrigger, handleScroll } = useScrollState(messages.length)
	const { currentToast, showInfo } = useToast()
	const {
		handleExtensionMessage,
		seenMessageIds,
		pendingCommandRef: _pendingCommandRef,
		firstTextMessageSkipped,
	} = useMessageHandlers({ nonInteractive })
	const { sendToExtension, runTask, cleanup } = useExtensionHost({
		initialPrompt,
		initialTaskId,
		initialSessionId,
		continueSession,
		mode,
		reasoningEffort,
		user,
		provider,
		apiKey,
		model,
		workspacePath,
		extensionPath,
		debug,
		nonInteractive,
		ephemeral,
		exitOnComplete,
		onExtensionMessage: handleExtensionMessage,
		createExtensionHost,
	})
	const { handleSubmit, handleApprove, handleReject } = useTaskSubmit({
		sendToExtension,
		runTask,
		seenMessageIds,
		firstTextMessageSkipped,
	})
	const { canToggleFocus, isScrollAreaActive, isInputAreaActive, toggleFocus } = useFocusManagement({
		showApprovalPrompt: Boolean(pendingAsk && pendingAsk.type !== "followup"),
		pendingAsk,
	})
	const { cancelCountdown } = useFollowupCountdown({ pendingAsk, onAutoSubmit: handleSubmit })
	const { handlePickerStateChange, handlePickerSelect, handlePickerClose, handlePickerIndexChange } =
		usePickerHandlers({
			autocompleteRef,
			followupAutocompleteRef,
			sendToExtension,
			showInfo,
			seenMessageIds,
			firstTextMessageSkipped,
		})
	useGlobalInput({
		canToggleFocus,
		isScrollAreaActive,
		pickerIsOpen: pickerState.isOpen,
		availableModes,
		currentMode,
		mode,
		sendToExtension,
		showInfo,
		exit,
		cleanup,
		toggleFocus,
		closePicker: handlePickerClose,
	})
	const view = getView(messages, pendingAsk, isLoading)
	if (error) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="red" bold>
					Error: {error}
				</Text>
				<Text color="gray" dimColor>
					Press Ctrl+C to exit
				</Text>
			</Box>
		)
	}
	return (
		<Box flexDirection="column" height={rows - 1}>
			<Box flexShrink={0}>
				<Header
					{...extensionHostOptions}
					mode={currentMode || mode}
					version={version}
					tokenUsage={tokenUsage}
					contextWindow={contextWindow}
				/>
			</Box>
			<ScrollArea
				isActive={isScrollAreaActive}
				onScroll={handleScroll}
				scrollToBottomTrigger={scrollToBottomTrigger}>
				{messages.map((message) => (
					<ChatHistoryItem key={message.id} message={message} />
				))}
			</ScrollArea>
			<InputArea
				autocompleteRef={autocompleteRef}
				followupAutocompleteRef={followupAutocompleteRef}
				sendToExtension={sendToExtension}
				workspacePath={workspacePath}
				handleSubmit={handleSubmit}
				handleApprove={handleApprove}
				handleReject={handleReject}
				cancelCountdown={cancelCountdown}
				handlePickerStateChange={handlePickerStateChange}
				handlePickerSelect={handlePickerSelect}
				handlePickerClose={handlePickerClose}
				handlePickerIndexChange={handlePickerIndexChange}
				setIsTransitioningToCustomInput={uiStateStore.setIsTransitioningToCustomInput}
				currentToast={currentToast}
				view={view}
				scrollTop={scrollState.scrollTop}
				maxScroll={scrollState.maxScroll}
				isScrollAreaActive={isScrollAreaActive}
				isInputAreaActive={isInputAreaActive}
			/>
		</Box>
	)
})

export function App(props: TUIAppProps) {
	return (
		<TerminalSizeProvider>
			<AppInner {...props} />
		</TerminalSizeProvider>
	)
}
