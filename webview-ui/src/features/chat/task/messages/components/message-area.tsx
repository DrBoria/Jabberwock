import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Container } from "@src/features/foundation/ui/Container"
import { observer } from "mobx-react-lite"
import { isAlive, isStateTreeNode } from "mobx-state-tree"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import useSound from "use-sound"
import { LRUCache } from "lru-cache"
import type { Notification, AudioType, SuggestionItem } from "@jabberwock/types"
import { ParentContextPanel } from "@src/features/chat/task/messages/components/parent-context-panel"
import ChatRow from "@src/features/chat/task/messages/components/row/view"
import { AskResponder } from "@src/features/chat/task/messages/components/ask-responder"
import { NavigationTriggers } from "@src/features/chat/task/messages/components/keyboard-shortcuts"
import TaskHeader from "@src/features/chat/topic/view"
import FileChangesPanel from "@src/features/chat/task/messages/components/file-changes-panel"
import { CheckpointWarning } from "@src/features/chat/task/notifications/checkpoint/checkpoint-warning"
import { DiagnosticDashboard } from "@jabberwock/devtool/webview"
import { rootStore } from "@src/features/store"
import { useChatUI } from "@src/features/chat/store"
import { useChatTree } from "@src/features/chat/task/messages/store"
import { getLatestTodo } from "@shared/todo"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { combineApiRequests } from "@shared/combineApiRequests"
import { combineCommandSequences } from "@shared/combineCommandSequences"
import { useScrollLifecycle } from "@src/hooks/useScrollLifecycle"
import { useDebounceEffect } from "@/features/settings/agents/mode-selector/utils/useDebounceEffect"
import { computeVisibleMessages } from "@src/features/chat/task/messages/components/utils/visible-messages"
import { computeGroupedMessages } from "@src/features/chat/task/messages/components/utils/grouped-messages"

export interface ChatAreaProps {
	isHidden: boolean
}

const ChatAreaComponent: React.FC<ChatAreaProps> = ({ isHidden }) => {
	const ui = useChatUI()
	const tree = useChatTree()
	const store = rootStore.chat
	const diagnostics = rootStore.extensionState.diagnostics

	const {
		currentTaskItem,
		messages: extensionMessages,
		messageQueue = [],
		alwaysAllowModeSwitch,
		soundEnabled,
		soundVolume,
	} = rootStore.extensionState

	const { t } = useAppTranslation()

	const currentNodeId = tree.activeNodeId?.id
	const nodes = useMemo(() => new Map(tree.nodes.entries()), [tree.nodes])

	// ── Sound hooks (played when AskStore returns AudioType) ────────────
	const [audioBaseUri] = useState(() => (window as Window & { AUDIO_BASE_URI?: string }).AUDIO_BASE_URI || "")
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

	// ── Message derivation (was in ChatView treeMessages) ──────────────
	const messagesRef = useRef<Notification[]>([])
	const treeMessages = useMemo(() => {
		const effectiveNodeId = currentTaskItem?.id
		if (effectiveNodeId) {
			const node = nodes.get(effectiveNodeId)
			if (node) {
				if (!isAlive(node)) return extensionMessages || []
				const hasUiMessages = node.uiMessages && node.uiMessages.length > 0
				const hasRawMessages = node.messages && node.messages.length > 0

				// Check if messages from extension state have newer data (live streaming updates)
				const uiMsgSnapshot = hasUiMessages ? (node.uiMessages as Notification[]) : undefined
				const sourceTs = hasUiMessages
					? uiMsgSnapshot?.at(-1)?.ts || 0
					: hasRawMessages
						? node.messages?.at(-1)?.ts || 0
						: 0
				const lastMessageTs = extensionMessages?.at(-1)?.ts || 0
				if (lastMessageTs > sourceTs) {
					return extensionMessages || []
				}

				// Prefer uiMessages - they are properly formatted Notification[] for UI rendering
				if (hasUiMessages) {
					return (node.uiMessages as Notification[]) || []
				}

				// Fall back to raw messages (cast as Notification - may not render fully)
				if (hasRawMessages) {
					return node.messages as Notification[]
				}
			}
		}
		const { isNavigating } = tree
		if (isNavigating && messagesRef.current.length > 0) return messagesRef.current
		return extensionMessages || []
	}, [currentTaskItem?.id, nodes, extensionMessages, tree])

	const messages = treeMessages
	useEffect(() => {
		messagesRef.current = messages
	}, [messages])

	const taskTs = currentTaskItem?.id

	// ── Refs (previously created in ChatView) ──────────────────────────
	const virtuosoRef = useRef<VirtuosoHandle>(null)
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const userRespondedRef = useRef(false)

	// ── Derived messages (moved from useAskState) ────────────────────
	const modifiedMessages = useMemo(() => combineApiRequests(combineCommandSequences(messages.slice(1))), [messages])

	// ── Ask state from store ─────────────────────────────────────────
	// Ask state is now managed by AskStore (MST). The store's processAskMessage
	// action writes directly to ChatUIStore. We read from ui.* which triggers
	// observer re-renders automatically.
	const currentAsk = ui.currentAsk || undefined
	const _enableButtons = ui.enableButtons
	const _primaryButtonText = ui.primaryButtonText
	const _secondaryButtonText = ui.secondaryButtonText
	const isStreaming = ui.isStreaming
	const _isFollowUpAutoApprovalPaused = ui.isFollowUpAutoApprovalPaused

	const currentAskRef = useRef<string | undefined>(currentAsk)
	useEffect(() => {
		currentAskRef.current = currentAsk
	}, [currentAsk])

	// ── Process last message via AskStore ────────────────────────────
	// This replaces the useEffect in useAskState that processed lastMessage.
	// The store action returns an AudioType to play.
	useEffect(() => {
		if (!messages || messages.length === 0) {
			store.ask.resetAskState()
			return
		}
		const soundType = store.ask.processAskMessage(messages, currentTaskItem, messageQueue, ui.inputValue, t)
		if (soundType) playSound(soundType)
	}, [messages, currentTaskItem, messageQueue, ui.inputValue, t, playSound, store.ask])

	// ── Update resume_task button text when messages change ─────────
	useEffect(() => {
		if (ui.currentAsk === "resume_task" && currentTaskItem?.parentTaskId) {
			store.ask.updateResumeTaskButton(messages, currentTaskItem, t)
		}
	}, [messages, currentTaskItem, ui.currentAsk, t, store.ask])

	// ── Cancel auto-approval when follow-up is paused ────────────────
	useEffect(() => {
		if (ui.isFollowUpAutoApprovalPaused) store.cancelAutoApproval()
	}, [ui.isFollowUpAutoApprovalPaused, store])

	// ── Reset UI on task change ──────────────────────────────────
	useEffect(() => {
		ui.resetTaskUI()
		userRespondedRef.current = false
	}, [currentTaskItem?.id, ui])

	// ── Aggregate costs ────────────────────────────────────────────
	useEffect(() => {
		if (currentTaskItem?.id && currentTaskItem?.childIds && currentTaskItem.childIds.length > 0) {
			store.getTaskWithAggregatedCosts(currentTaskItem.id)
		}
	}, [taskTs, currentTaskItem?.id, currentTaskItem?.childIds, store])

	// ── Scroll Lifecycle ──────────────────────────────────────────
	const {
		showScrollToBottom,
		handleRowHeightChange,
		handleScrollToBottomClick,
		enterUserBrowsingHistory,
		followOutputCallback,
		atBottomStateChangeCallback,
	} = useScrollLifecycle({
		virtuosoRef,
		scrollContainerRef,
		taskTs: currentTaskItem?.ts,
		isStreaming,
		isHidden,
		hasTask: !!currentTaskItem,
	})

	// ── Sync scroll state into ChatUIStore ──────────────────────
	useEffect(() => {
		ui.setShowScrollToBottom(showScrollToBottom)
	}, [showScrollToBottom, ui])

	// ── Derived state (previously in ChatView) ────────────────────
	const _isProfileDisabled = false // profile validation is ChatView concern
	const parentNode = useMemo(() => {
		const effectiveNodeId = currentNodeId || currentTaskItem?.id
		const activeNode = effectiveNodeId ? nodes.get(effectiveNodeId) : undefined
		const parentNodeId = activeNode?.parentId || currentTaskItem?.parentTaskId
		return parentNodeId ? nodes.get(parentNodeId) : undefined
	}, [currentNodeId, currentTaskItem?.id, currentTaskItem?.parentTaskId, nodes])

	const isNested = !!parentNode

	const currentTaskTodos = rootStore.extensionState.currentTaskTodos
	const _latestTodos = useMemo(() => {
		if (currentTaskTodos && currentTaskTodos.length > 0) {
			const messageBasedTodos = getLatestTodo(messages)
			if (messageBasedTodos && messageBasedTodos.length > 0) return messageBasedTodos
			return currentTaskTodos
		}
		if (isStateTreeNode(messages) && !isAlive(messages)) return []
		return getLatestTodo(messages)
	}, [messages, currentTaskTodos])

	// ── Handlers ─────────────────────────────────────────────────
	const markFollowUpAsAnswered = useCallback(() => {
		const lastFollowUpMessage = messagesRef.current.findLast((msg: Notification) => msg.ask === "followup")
		if (lastFollowUpMessage) ui.setCurrentFollowUpTs(lastFollowUpMessage.ts)
	}, [ui])

	const handleChatReset = useCallback(
		(shouldPostMessage: boolean = true) => {
			userRespondedRef.current = false
			if (shouldPostMessage) store.clearTask()
			ui.clearInput()
			store.ask.resetAskState()
		},
		[ui, store],
	)

	const handleSendMessage = useCallback(
		(text: string, images: string[]) => {
			text = text.trim()
			if (text || images.length > 0) {
				// Check retired provider skipped — apiConfiguration not directly available here
				// (it's handled by ChatView's onSend wrapper)
				if (
					ui.sendingDisabled ||
					isStreaming ||
					messageQueue.length > 0 ||
					currentAskRef.current === "command_output"
				) {
					store.queueMessage(text, images)
					ui.clearInput()
					return
				}
				userRespondedRef.current = true
				if (messagesRef.current.length === 0) {
					store.sendMessage(text, images)
				} else if (currentAskRef.current) {
					if (currentAskRef.current === "followup") markFollowUpAsAnswered()
					switch (currentAskRef.current) {
						case "followup":
						case "tool":
						case "command":
						case "use_mcp_server":
						case "completion_result":
						case "resume_task":
						case "resume_completed_task":
						case "mistake_limit_reached":
							store.respondToAsk("messageResponse", text, images)
							break
					}
				} else {
					store.respondToAsk("messageResponse", text, images)
				}
				handleChatReset(false)
			}
		},
		[handleChatReset, markFollowUpAsAnswered, isStreaming, messageQueue.length, ui, store],
	)

	const handlePrimaryButtonClick = useCallback(
		(text?: string, images?: string[]) => {
			userRespondedRef.current = true
			store.handlePrimaryButtonClick(currentAsk, currentTaskItem, messagesRef.current, text, images)
			store.ask.resetAskState()
		},
		[currentAsk, currentTaskItem, store],
	)

	const handleSecondaryButtonClick = useCallback(
		(text?: string, images?: string[]) => {
			if (userRespondedRef.current) return // prevent double-processing
			userRespondedRef.current = true
			store.handleSecondaryButtonClick(currentAsk, isStreaming, text, images)
			store.ask.resetAskState()
		},
		[currentAsk, isStreaming, store],
	)

	const handleSuggestionClickInRow = useCallback(
		(suggestion: SuggestionItem, event?: React.MouseEvent) => {
			if (event) userRespondedRef.current = true
			if (currentAsk === "followup" && !event?.shiftKey) markFollowUpAsAnswered()
			if (suggestion.mode) {
				const isManualClick = !!event
				if (isManualClick || alwaysAllowModeSwitch) {
					store.navigateToTask(suggestion.id || "")
				}
			}
			if (event?.shiftKey) {
				ui.setInputValue(ui.inputValue !== "" ? `${ui.inputValue} \n${suggestion.answer}` : suggestion.answer)
			} else {
				handleSendMessage(suggestion.answer, [])
			}
		},
		[handleSendMessage, alwaysAllowModeSwitch, currentAsk, markFollowUpAsAnswered, store, ui],
	)

	// ── Visible Messages ──────────────────────────────────────────
	const everVisibleMessagesTsRef = useRef<LRUCache<number, boolean>>(new LRUCache({ max: 100, ttl: 1000 * 60 * 5 }))

	useEffect(() => {
		if (isHidden) everVisibleMessagesTsRef.current.clear()
	}, [isHidden])

	const visibleMessages = useMemo(() => computeVisibleMessages(modifiedMessages), [modifiedMessages])

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
				if (lastSeenTs) store.acknowledgeLastMessageSeen(String(lastSeenTs))
			}
		},
		2000,
		[visibleMessages.length],
	)

	// ── Message Grouping ──────────────────────────────────────────
	const groupedMessages = useMemo(
		() => computeGroupedMessages(visibleMessages, ui.isCondensing),
		[visibleMessages, ui.isCondensing],
	)

	// ── Expanded Rows → enterUserBrowsingHistory ────────────────────
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
		if (isHidden || !currentTaskItem) ui.setCheckpointWarning(undefined)
	}, [modifiedMessages.length, isStreaming, isHidden, currentTaskItem, ui])

	// ── Item content renderer ──────────────────────────────────────
	const itemContent = (index: number, messageOrGroup: Notification) => {
		return (
			<ChatRow
				key={`${messageOrGroup.ts}-${index}`}
				message={messageOrGroup}
				lastModifiedMessage={modifiedMessages.at(-1)}
				isLast={index === groupedMessages.length - 1}
				onHeightChange={handleRowHeightChange}
				onSuggestionClick={handleSuggestionClickInRow}
				isNested={isNested}
			/>
		)
	}

	return (
		<>
			<DiagnosticDashboard
				diagnostics={diagnostics}
				isStreaming={isStreaming}
				devtoolEnabled={rootStore.extensionState.devtoolEnabled}
			/>
			<TaskHeader />
			<ParentContextPanel parentNode={parentNode} />
			{ui.checkpointWarning && (
				<div className="px-3">
					<CheckpointWarning
						warning={ui.checkpointWarning as { type: "WAIT_TIMEOUT" | "INIT_TIMEOUT"; timeout: number }}
					/>
				</div>
			)}
			<Container className="flex grow overflow-hidden relative">
				<Container className="flex flex-col grow min-w-0 overflow-hidden relative">
					<div className="grow flex" ref={scrollContainerRef as React.RefObject<HTMLDivElement>}>
						<Virtuoso
							ref={virtuosoRef as React.RefObject<VirtuosoHandle>}
							key={currentTaskItem?.id || "no-task"}
							className="scrollable grow overflow-y-scroll mb-1"
							increaseViewportBy={{ top: 3_000, bottom: 1000 }}
							data={groupedMessages}
							itemContent={itemContent}
							followOutput={followOutputCallback}
							atBottomStateChange={atBottomStateChangeCallback}
							atBottomThreshold={10}
						/>
					</div>
					<NavigationTriggers
						currentNodeId={currentNodeId}
						nodes={nodes}
						onNavigateToNode={(nodeId) => tree.navigateToNode(nodeId)}
						onOpenHierarchy={() => {
							window.postMessage({ type: "pushWindow", text: "task_hierarchy" }, "*")
						}}
					/>
					<FileChangesPanel messages={messages} />
					<AskResponder
						onPrimaryClick={handlePrimaryButtonClick}
						onSecondaryClick={handleSecondaryButtonClick}
						onScrollToBottom={handleScrollToBottomClick}
					/>
				</Container>
			</Container>
		</>
	)
}

export const ChatArea = observer(ChatAreaComponent)
