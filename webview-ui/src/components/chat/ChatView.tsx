import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react"
import { useEvent } from "react-use"
import { type VirtuosoHandle } from "react-virtuoso"
import useSound from "use-sound"
import { LRUCache } from "lru-cache"

import { observer } from "mobx-react-lite"
import { isAlive, isStateTreeNode } from "mobx-state-tree"

import { useDebounceEffect } from "@src/utils/useDebounceEffect"

import type { ClineMessage, ExtensionMessage, AudioType } from "@jabberwock/types"
import { isRetiredProvider, SuggestionItem } from "@jabberwock/types"
import { getAllModes } from "@shared/modes"
import { ProfileValidator } from "@shared/ProfileValidator"
import { getLatestTodo } from "@shared/todo"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useChatTree } from "@src/context/ChatTreeContext"
import { useChatUI } from "@src/context/ChatUIContext"
import { useSelectedModel } from "@src/components/ui/hooks/useSelectedModel"
import { CloudUpsellDialog } from "@src/components/cloud/CloudUpsellDialog"

import TelemetryBanner from "../common/TelemetryBanner"
import Announcement from "./Announcement"
import WarningRow from "./WarningRow"
import { ChatTextArea } from "./ChatTextArea"
import ProfileViolationWarning from "./ProfileViolationWarning"
import { QueuedMessages } from "./QueuedMessages"

import { useCloudUpsell } from "@src/hooks/useCloudUpsell"
import { useAskState } from "@src/hooks/useAskState"
import { useScrollLifecycle } from "@src/hooks/useScrollLifecycle"

import { useChatDragAndDrop } from "../../features/context-drag-drop/useChatDragAndDrop"
import { ChatDropZoneOverlay } from "../../features/context-drag-drop/ChatDropZoneOverlay"

import { useWindowManager } from "@src/context/WindowManagerContext"

import { HomeScreen } from "./ChatView/HomeScreen"
import { ChatArea } from "./ChatView/ChatArea"

import { computeVisibleMessages } from "./utils/visibleMessages"
import { computeGroupedMessages } from "./utils/groupedMessages"
import { dispatchExtensionMessage, type MessageHandlerContext } from "./utils/handlerMaps"

export interface ChatViewProps {
	isHidden: boolean
	showAnnouncement: boolean
	hideAnnouncement: () => void
	targetNodeId?: string
}

export interface ChatViewRef {
	acceptInput: () => void
}

export const MAX_IMAGES_PER_MESSAGE = 20

const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0

const ChatViewComponent: React.ForwardRefRenderFunction<ChatViewRef, ChatViewProps> = (props, ref) => {
	const { isHidden, showAnnouncement, hideAnnouncement } = props
	const [audioBaseUri] = React.useState(() => (window as unknown as { AUDIO_BASE_URI?: string }).AUDIO_BASE_URI || "")

	const { t } = useAppTranslation()
	const modeShortcutText = `${isMac ? "⌘" : "Ctrl"} + . ${t("chat:forNextMode")}, ${isMac ? "⌘" : "Ctrl"} + Shift + . ${t("chat:forPreviousMode")}`

	const {
		currentTaskItem,
		currentTaskTodos,
		taskHistory,
		apiConfiguration,
		organizationAllowList,
		mode,
		setMode,
		alwaysAllowModeSwitch,
		customModes,
		telemetrySetting,
		soundEnabled,
		soundVolume,
		cloudIsAuthenticated,
		clineMessages,
		messageQueue = [],
		cwd,
		diagnostics,
		devtoolEnabled,
	} = useExtensionState()

	const { pushWindow: _pushWindow } = useWindowManager()
	const { nodes, isNavigating } = useChatTree()
	const store = useChatTree()
	const ui = useChatUI()

	// ── Refs ──────────────────────────────────────────────────────
	const textAreaRef = useRef<HTMLTextAreaElement>(null)
	const virtuosoRef = useRef<VirtuosoHandle>(null)
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const _lastTtsRef = useRef<string>("")
	const messagesRef = useRef(clineMessages)
	const everVisibleMessagesTsRef = useRef<LRUCache<number, boolean>>(new LRUCache({ max: 100, ttl: 1000 * 60 * 5 }))
	const autoApproveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	const userRespondedRef = useRef(false)

	const { isOpen: isUpsellOpen, openUpsell, closeUpsell, handleConnect } = useCloudUpsell({ autoOpenOnAuth: false })

	// ── Derived State ────────────────────────────────────────────
	const treeMessages = useMemo(() => {
		const effectiveNodeId = props.targetNodeId || currentTaskItem?.id
		if (effectiveNodeId) {
			const node = nodes.get(effectiveNodeId)
			if (node) {
				if (!isAlive(node)) return clineMessages || []
				const hasUiMessages = node.uiMessages && node.uiMessages.length > 0
				const hasRawMessages = node.messages && node.messages.length > 0

				if (!props.targetNodeId) {
					const nodeLastTs = hasRawMessages ? node.messages.at(-1)?.ts || 0 : 0
					const clineLastTs = clineMessages?.at(-1)?.ts || 0
					if (clineLastTs > nodeLastTs) {
						return clineMessages || []
					}
				}

				if (
					hasRawMessages &&
					(!hasUiMessages || (node.messages.at(-1)?.ts || 0) > (node.uiMessages?.at(-1)?.ts || 0))
				) {
					return node.messages as ClineMessage[]
				}
				if (hasUiMessages) return node.uiMessages as ClineMessage[]
			}
		}
		if (isNavigating && messagesRef.current && messagesRef.current.length > 0) return messagesRef.current
		return clineMessages || []
	}, [props.targetNodeId, currentTaskItem?.id, nodes, clineMessages, isNavigating])

	const messages = treeMessages
	useEffect(() => {
		messagesRef.current = messages
	}, [messages])

	const task = useMemo(() => messages.at(0), [messages])

	const latestTodos = useMemo(() => {
		if (currentTaskTodos && currentTaskTodos.length > 0) {
			const messageBasedTodos = getLatestTodo(messages)
			if (messageBasedTodos && messageBasedTodos.length > 0) return messageBasedTodos
			return currentTaskTodos
		}
		if (isStateTreeNode(messages) && !isAlive(messages)) return []
		return getLatestTodo(messages)
	}, [messages, currentTaskTodos])

	const { isDragging, dragHandlers } = useChatDragAndDrop({
		inputValue: ui.inputValue,
		setInputValue: ui.setInputValue,
		cwd: cwd ?? "",
	})

	const isProfileDisabled = useMemo(
		() => !!apiConfiguration && !ProfileValidator.isProfileAllowed(apiConfiguration, organizationAllowList),
		[apiConfiguration, organizationAllowList],
	)

	// ── Sound ────────────────────────────────────────────────────
	const volume = typeof soundVolume === "number" ? soundVolume : 0.5
	const [playNotification] = useSound(`${audioBaseUri}/notification.wav`, { volume, soundEnabled, interrupt: true })
	const [playCelebration] = useSound(`${audioBaseUri}/celebration.wav`, { volume, soundEnabled, interrupt: true })
	const [playProgressLoop] = useSound(`${audioBaseUri}/progress_loop.wav`, { volume, soundEnabled, interrupt: true })
	const lastPlayedRef = useRef<Record<string, number>>({})

	const playSound = useCallback(
		(audioType: AudioType) => {
			if (!soundEnabled) return
			const now = Date.now()
			const lastPlayed = lastPlayedRef.current[audioType] ?? 0
			if (now - lastPlayed < 100) return
			lastPlayedRef.current[audioType] = now
			switch (audioType) {
				case "notification":
					playNotification()
					break
				case "celebration":
					playCelebration()
					break
				case "progress_loop":
					playProgressLoop()
					break
			}
		},
		[soundEnabled, playNotification, playCelebration, playProgressLoop],
	)

	const {
		clineAsk,
		enableButtons,
		primaryButtonText,
		secondaryButtonText,
		isStreaming,
		isFollowUpAutoApprovalPaused,
		modifiedMessages,
		apiMetrics,
		resetAskState,
	} = useAskState(messages, currentTaskItem, messageQueue, playSound, ui.inputValue)

	const clineAskRef = useRef(clineAsk)
	useEffect(() => {
		clineAskRef.current = clineAsk
	}, [clineAsk])

	useEffect(() => {
		if (isFollowUpAutoApprovalPaused) vscode.postMessage({ type: "cancelAutoApproval" })
	}, [isFollowUpAutoApprovalPaused])

	// function _playTts(text: string) {
	// 	vscode.postMessage({ type: "playTts", text })
	// }

	// ── Reset UI on task change ──────────────────────────────────
	useEffect(() => {
		ui.resetTaskUI()
		if (autoApproveTimeoutRef.current) {
			clearTimeout(autoApproveTimeoutRef.current)
			autoApproveTimeoutRef.current = null
		}
		userRespondedRef.current = false
		everVisibleMessagesTsRef.current.clear()
	}, [task?.ts, ui])

	const taskTs = task?.ts

	useEffect(() => {
		if (taskTs && currentTaskItem?.childIds && currentTaskItem.childIds.length > 0) {
			vscode.postMessage({ type: "getTaskWithAggregatedCosts", text: currentTaskItem.id })
		}
	}, [taskTs, currentTaskItem?.id, currentTaskItem?.childIds])

	useEffect(() => {
		if (isHidden) everVisibleMessagesTsRef.current.clear()
	}, [isHidden])
	useEffect(() => {
		const c = everVisibleMessagesTsRef.current
		return () => c.clear()
	}, [])

	// ── Handlers ─────────────────────────────────────────────────
	const markFollowUpAsAnswered = useCallback(() => {
		const lastFollowUpMessage = messagesRef.current.findLast((msg: ClineMessage) => msg.ask === "followup")
		if (lastFollowUpMessage) ui.setCurrentFollowUpTs(lastFollowUpMessage.ts)
	}, [ui])

	const handleChatReset = useCallback(
		(shouldPostMessage: boolean = true) => {
			if (autoApproveTimeoutRef.current) {
				clearTimeout(autoApproveTimeoutRef.current)
				autoApproveTimeoutRef.current = null
			}
			userRespondedRef.current = false
			if (shouldPostMessage) vscode.postMessage({ type: "clearTask" })
			ui.clearInput()
			ui.setSendingDisabled(false)
			resetAskState()
		},
		[ui, resetAskState],
	)

	const handleSendMessage = useCallback(
		(text: string, images: string[]) => {
			text = text.trim()
			if (text || images.length > 0) {
				if (apiConfiguration?.apiProvider && isRetiredProvider(apiConfiguration.apiProvider)) {
					ui.setShowRetiredProviderWarning(true)
					return
				}
				if (
					ui.sendingDisabled ||
					isStreaming ||
					messageQueue.length > 0 ||
					clineAskRef.current === "command_output"
				) {
					vscode.postMessage({ type: "queueMessage", text, images })
					ui.clearInput()
					return
				}
				userRespondedRef.current = true
				if (messagesRef.current.length === 0) {
					vscode.postMessage({ type: "newTask", text, images })
				} else if (clineAskRef.current) {
					if (clineAskRef.current === "followup") markFollowUpAsAnswered()
					switch (clineAskRef.current) {
						case "followup":
						case "tool":
						case "command":
						case "use_mcp_server":
						case "completion_result":
						case "resume_task":
						case "resume_completed_task":
						case "mistake_limit_reached":
							vscode.postMessage({ type: "askResponse", askResponse: "messageResponse", text, images })
							break
					}
				} else {
					vscode.postMessage({ type: "askResponse", askResponse: "messageResponse", text, images })
				}
				handleChatReset(true)
			}
		},
		[handleChatReset, markFollowUpAsAnswered, isStreaming, messageQueue.length, apiConfiguration?.apiProvider, ui],
	)

	const handleSetChatBoxMessage = useCallback(
		(text: string, images: string[]) => {
			ui.setInputValue(ui.inputValue !== "" ? ui.inputValue + " " + text : text)
			ui.appendSelectedImages(images)
		},
		[ui],
	)

	const startNewTask = useCallback(() => {
		ui.setShowRetiredProviderWarning(false)
		ui.clearInput()
		vscode.postMessage({ type: "clearTask" })
	}, [ui])

	const handleStopTask = useCallback(() => {
		vscode.postMessage({ type: "cancelTask" })
	}, [])

	const handleEnqueueCurrentMessage = useCallback(() => {
		const text = ui.inputValue.trim()
		const images = ui.selectedImages.slice()
		if (text || images.length > 0) {
			vscode.postMessage({ type: "queueMessage", text, images })
			ui.clearInput()
		}
	}, [ui])

	const handlePrimaryButtonClick = useCallback(
		(text?: string, images?: string[]) => {
			userRespondedRef.current = true
			const trimmedInput = text?.trim()
			switch (clineAsk) {
				case "api_req_failed":
				case "command":
				case "tool":
				case "use_mcp_server":
				case "mistake_limit_reached":
					if (trimmedInput || (images && images.length > 0)) {
						vscode.postMessage({
							type: "askResponse",
							askResponse: "yesButtonClicked",
							text: trimmedInput,
							images,
						})
						ui.clearInput()
					} else {
						vscode.postMessage({ type: "askResponse", askResponse: "yesButtonClicked" })
					}
					break
				case "resume_task":
					if (
						currentTaskItem?.parentTaskId &&
						messagesRef.current.some(
							(msg) => msg.ask === "completion_result" || msg.say === "completion_result",
						)
					) {
						startNewTask()
					} else {
						if (trimmedInput || (images && images.length > 0)) {
							vscode.postMessage({
								type: "askResponse",
								askResponse: "yesButtonClicked",
								text: trimmedInput,
								images,
							})
							ui.clearInput()
						} else {
							vscode.postMessage({ type: "askResponse", askResponse: "yesButtonClicked" })
						}
					}
					break
				case "completion_result":
				case "resume_completed_task":
					startNewTask()
					break
				case "command_output":
					vscode.postMessage({ type: "terminalOperation", terminalOperation: "continue" })
					break
			}
			ui.setSendingDisabled(true)
			resetAskState()
		},
		[clineAsk, startNewTask, currentTaskItem?.parentTaskId, resetAskState, ui],
	)

	const handleSecondaryButtonClick = useCallback(
		(text?: string, images?: string[]) => {
			userRespondedRef.current = true
			const trimmedInput = text?.trim()
			if (isStreaming) {
				vscode.postMessage({ type: "cancelTask" })
				return
			}
			switch (clineAsk) {
				case "api_req_failed":
				case "mistake_limit_reached":
				case "resume_task":
					startNewTask()
					break
				case "command":
				case "tool":
				case "use_mcp_server":
					if (trimmedInput || (images && images.length > 0)) {
						vscode.postMessage({
							type: "askResponse",
							askResponse: "noButtonClicked",
							text: trimmedInput,
							images,
						})
						ui.clearInput()
					} else {
						vscode.postMessage({ type: "askResponse", askResponse: "noButtonClicked" })
					}
					break
				case "command_output":
					vscode.postMessage({ type: "terminalOperation", terminalOperation: "abort" })
					break
			}
			ui.setSendingDisabled(true)
			resetAskState()
		},
		[clineAsk, startNewTask, isStreaming, resetAskState, ui],
	)

	const { info: model } = useSelectedModel(apiConfiguration)
	const selectImages = useCallback(() => vscode.postMessage({ type: "selectImages" }), [])
	const shouldDisableImages = !model?.supportsImages || ui.selectedImages.length >= MAX_IMAGES_PER_MESSAGE

	// ── Message Handler (object-based dispatch) ──────────────────
	const handleMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data
			const handlerCtx: MessageHandlerContext = {
				isHidden,
				sendingDisabled: ui.sendingDisabled,
				enableButtons,
				isCondensing: ui.isCondensing,
				textAreaRef,
				handleChatReset,
				handleSendMessage,
				handleSetChatBoxMessage,
				handlePrimaryButtonClick,
				handleSecondaryButtonClick,
				playSound,
				setIsCondensing: ui.setIsCondensing,
				setSendingDisabled: ui.setSendingDisabled,
				appendSelectedImages: ui.appendSelectedImages,
				setCheckpointWarning: ui.setCheckpointWarning,
				updateAggregatedCosts: ui.updateAggregatedCosts,
				MAX_IMAGES_PER_MESSAGE,
			}
			dispatchExtensionMessage(message, handlerCtx)
		},
		[
			isHidden,
			ui,
			enableButtons,
			handleChatReset,
			handleSendMessage,
			handleSetChatBoxMessage,
			handlePrimaryButtonClick,
			handleSecondaryButtonClick,
			playSound,
		],
	)

	useEvent("message", handleMessage)

	// ── Visible Messages (object-based) ──────────────────────────
	const visibleMessages = useMemo(() => computeVisibleMessages(modifiedMessages), [modifiedMessages])

	// ── Visibility Tracking ──────────────────────────────────────
	useEffect(() => {
		const cleanupInterval = setInterval(() => {
			const cache = everVisibleMessagesTsRef.current
			visibleMessages.forEach((msg) => {
				cache.set(msg.ts, true)
			})
		}, 500)
		return () => clearInterval(cleanupInterval)
	}, [visibleMessages])

	useDebounceEffect(
		() => {
			const cache = everVisibleMessagesTsRef.current
			const lastVisible = visibleMessages.at(-1)
			if (lastVisible && cache.has(lastVisible.ts)) {
				const lastSeenTs = Array.from(cache.keys()).sort((a, b) => b - a)[0]
				if (lastSeenTs) vscode.postMessage({ type: "lastMessageSeen" as any, text: String(lastSeenTs) })
			}
		},
		2000,
		[visibleMessages.length],
	)

	// ── Message Grouping (object-based) ──────────────────────────
	const groupedMessages = useMemo(
		() => computeGroupedMessages(visibleMessages, ui.isCondensing),
		[visibleMessages, ui.isCondensing],
	)

	// ── Scroll Lifecycle ──────────────────────────────────────────
	const {
		showScrollToBottom,
		handleRowHeightChange,
		handleScrollToBottomClick,
		enterUserBrowsingHistory,
		followOutputCallback,
		atBottomStateChangeCallback,
		scrollToBottomAuto,
		isAtBottomRef,
		scrollPhaseRef,
	} = useScrollLifecycle({
		virtuosoRef,
		scrollContainerRef,
		taskTs: task?.ts,
		isStreaming,
		isHidden,
		hasTask: !!task,
	})

	// ── Expanded Rows ─────────────────────────────────────────────
	const prevExpandedRowsRef = useRef<Record<number, boolean>>({})
	useEffect(() => {
		const prev = prevExpandedRowsRef.current
		let wasAnyRowExpandedByUser = false
		if (prev) {
			for (const [tsKey, isExpanded] of Object.entries(ui.expandedRows)) {
				const ts = Number(tsKey)
				if (isExpanded && !(prev[ts] ?? false)) {
					wasAnyRowExpandedByUser = true
					break
				}
			}
		}
		if (wasAnyRowExpandedByUser) enterUserBrowsingHistory("row-expansion")
		prevExpandedRowsRef.current = ui.expandedRows
	}, [enterUserBrowsingHistory, ui.expandedRows])

	// ── Clear checkpoint warning ──────────────────────────────────
	useEffect(() => {
		if (isHidden || !task) ui.setCheckpointWarning(null)
	}, [modifiedMessages.length, isStreaming, isHidden, task, ui])

	const placeholderText = task ? t("chat:typeMessage") : t("chat:typeTask")

	// ── Mode Switching ────────────────────────────────────────────
	const switchToMode = useCallback(
		(modeSlug: string): void => {
			setMode(modeSlug)
			vscode.postMessage({ type: "mode", text: modeSlug })
		},
		[setMode],
	)

	const switchToNextMode = useCallback(() => {
		const allModes = getAllModes(customModes)
		const currentModeIndex = allModes.findIndex((m) => m.slug === mode)
		const nextModeIndex = (currentModeIndex + 1) % allModes.length
		switchToMode(allModes[nextModeIndex].slug)
	}, [mode, customModes, switchToMode])

	const switchToPreviousMode = useCallback(() => {
		const allModes = getAllModes(customModes)
		const currentModeIndex = allModes.findIndex((m) => m.slug === mode)
		const previousModeIndex = (currentModeIndex - 1 + allModes.length) % allModes.length
		switchToMode(allModes[previousModeIndex].slug)
	}, [mode, customModes, switchToMode])

	// ── Suggestion Click ──────────────────────────────────────────
	const handleSuggestionClickInRow = useCallback(
		(suggestion: SuggestionItem, event?: React.MouseEvent) => {
			if (event) userRespondedRef.current = true
			if (clineAsk === "followup" && !event?.shiftKey) markFollowUpAsAnswered()
			if (suggestion.mode) {
				const isManualClick = !!event
				if (isManualClick || alwaysAllowModeSwitch) {
					store.navigateToNode(suggestion.id || "")
					vscode.postMessage({ type: "showTaskWithId", text: suggestion.id })
				}
			}
			if (event?.shiftKey) {
				ui.setInputValue(ui.inputValue !== "" ? `${ui.inputValue} \n${suggestion.answer}` : suggestion.answer)
			} else {
				const _preservedInput = messagesRef.current
				handleSendMessage(suggestion.answer, [])
			}
		},
		[handleSendMessage, alwaysAllowModeSwitch, clineAsk, markFollowUpAsAnswered, store, ui],
	)

	const handleBatchFileResponse = useCallback((response: { [key: string]: boolean }) => {
		vscode.postMessage({ type: "askResponse", askResponse: "objectResponse", text: JSON.stringify(response) })
	}, [])

	const handleFollowUpUnmount = useCallback(() => {
		vscode.postMessage({ type: "cancelAutoApproval" })
	}, [])

	// ── Keyboard Shortcuts ────────────────────────────────────────
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key === ".") {
				event.preventDefault()
				if (event.shiftKey) switchToPreviousMode()
				else switchToNextMode()
			}
		},
		[switchToNextMode, switchToPreviousMode],
	)

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [handleKeyDown])

	// ── Imperative Handle ─────────────────────────────────────────
	useImperativeHandle(ref, () => ({
		acceptInput: () => {
			const hasInput = ui.inputValue.trim() || ui.selectedImages.length > 0
			if (clineAskRef.current === "command_output" && hasInput) {
				const images = ui.selectedImages.slice()
				vscode.postMessage({ type: "queueMessage", text: ui.inputValue.trim(), images })
				ui.clearInput()
				return
			}
			if (enableButtons && primaryButtonText) {
				handlePrimaryButtonClick(ui.inputValue, ui.selectedImages.slice())
			} else if (!ui.sendingDisabled && !isProfileDisabled && hasInput) {
				handleSendMessage(ui.inputValue, ui.selectedImages)
			}
		},
	}))

	const handleCondenseContext = (taskId: string) => {
		if (ui.isCondensing || ui.sendingDisabled) return
		ui.setIsCondensing(true)
		ui.setSendingDisabled(true)
		vscode.postMessage({ type: "condenseTaskContextRequest", text: taskId })
	}

	// ── Render ────────────────────────────────────────────────────
	const effectiveNodeId = props.targetNodeId || currentTaskItem?.id
	const activeNode = effectiveNodeId ? nodes.get(effectiveNodeId) : undefined
	const parentNodeId = activeNode?.parentId || currentTaskItem?.parentTaskId
	const parentNode = parentNodeId ? nodes.get(parentNodeId) : undefined

	if (!task) {
		return (
			<HomeScreen
				devtoolEnabled={devtoolEnabled}
				taskHistory={taskHistory}
				cloudIsAuthenticated={cloudIsAuthenticated}
				showAnnouncementModal={ui.showAnnouncementModal}
				setShowAnnouncementModal={ui.setShowAnnouncementModal}
				openUpsell={openUpsell}
			/>
		)
	}

	return (
		<div
			{...dragHandlers}
			data-testid="chat-view"
			className="fixed top-0 left-0 right-0 bottom-0 flex flex-col overflow-hidden">
			<ChatDropZoneOverlay isDragging={isDragging} />
			{telemetrySetting === "unset" && <TelemetryBanner />}
			{(showAnnouncement || ui.showAnnouncementModal) && (
				<Announcement
					hideAnnouncement={() => {
						if (ui.showAnnouncementModal) ui.setShowAnnouncementModal(false)
						if (showAnnouncement) hideAnnouncement()
					}}
				/>
			)}
			<ChatArea
				task={task}
				taskTs={taskTs}
				messages={messages}
				groupedMessages={groupedMessages}
				modifiedMessages={modifiedMessages}
				isStreaming={isStreaming}
				isFollowUpAutoApprovalPaused={isFollowUpAutoApprovalPaused}
				isNested={!!props.targetNodeId}
				enableButtons={enableButtons}
				primaryButtonText={primaryButtonText}
				secondaryButtonText={secondaryButtonText}
				showScrollToBottom={showScrollToBottom}
				diagnostics={diagnostics}
				apiMetrics={apiMetrics}
				latestTodos={latestTodos}
				handleCondenseContext={handleCondenseContext}
				onPrimaryClick={handlePrimaryButtonClick}
				onSecondaryClick={handleSecondaryButtonClick}
				onScrollToBottom={handleScrollToBottomClick}
				onSuggestionClick={handleSuggestionClickInRow}
				onBatchFileResponse={handleBatchFileResponse}
				onFollowUpUnmount={handleFollowUpUnmount}
				onRowHeightChange={handleRowHeightChange}
				virtuosoRef={virtuosoRef}
				scrollContainerRef={scrollContainerRef}
				followOutputCallback={followOutputCallback}
				atBottomStateChangeCallback={atBottomStateChangeCallback}
				parentNode={parentNode}
			/>
			<QueuedMessages
				queue={messageQueue}
				onRemove={(index) => {
					if (messageQueue[index])
						vscode.postMessage({ type: "removeQueuedMessage", text: messageQueue[index].id })
				}}
				onUpdate={(index, newText) => {
					if (messageQueue[index])
						vscode.postMessage({
							type: "editQueuedMessage",
							payload: { id: messageQueue[index].id, text: newText, images: messageQueue[index].images },
						})
				}}
			/>
			{ui.showRetiredProviderWarning && (
				<div className="px-[15px] py-1">
					<WarningRow
						title={t("chat:retiredProvider.title")}
						message={t("chat:retiredProvider.message")}
						actionText={t("chat:retiredProvider.openSettings")}
						onAction={() => vscode.postMessage({ type: "switchTab", tab: "settings" })}
					/>
				</div>
			)}
			<ChatTextArea
				ref={textAreaRef}
				placeholderText={placeholderText}
				onSend={() => handleSendMessage(ui.inputValue, ui.selectedImages.slice())}
				onSelectImages={selectImages}
				shouldDisableImages={shouldDisableImages}
				onHeightChange={() => {
					if (isAtBottomRef.current && scrollPhaseRef.current !== "USER_BROWSING_HISTORY") {
						scrollToBottomAuto()
					}
				}}
				modeShortcutText={modeShortcutText}
				isStreaming={isStreaming}
				onStop={handleStopTask}
				onEnqueueMessage={handleEnqueueCurrentMessage}
			/>
			{isProfileDisabled && (
				<div className="px-3">
					<ProfileViolationWarning />
				</div>
			)}
			<div id="jabberwock-portal" />
			<CloudUpsellDialog open={isUpsellOpen} onOpenChange={closeUpsell} onConnect={handleConnect} />
		</div>
	)
}

export default observer(forwardRef(ChatViewComponent))
