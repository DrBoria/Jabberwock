import type React from "react"
import { useEffect, useRef } from "react"
import { useDebounceEffect } from "@/features/settings/agents/mode-selector/utils/useDebounceEffect"
import type { Notification, AudioType } from "@jabberwock/types"
import { LRUCache } from "lru-cache"
import type { IChatUIStore, IChatStore } from "@src/features/chat/store"
import type { ScrollFollowDisengageSource } from "@src/hooks/scroll-lifecycle/useScrollLifecycle-helpers"

export interface UseChatAreaEffectsParams {
	isHidden: boolean
	messages: Notification[]
	currentTaskItem: { id?: string; parentTaskId?: string; ts?: number } | undefined
	currentTaskItemId: string | undefined
	messageQueue: { id: string; text: string; timestamp: number; images?: string[] }[]
	ui: IChatUIStore
	t: (key: string) => string
	playSound: (audioType: AudioType) => void
	store: IChatStore
	currentAsk: string | undefined
	showScrollToBottom: boolean
	visibleMessages: Notification[]
	modifiedMessagesLength: number
	isStreaming: boolean
	messagesRef: React.MutableRefObject<Notification[]>
	currentAskRef: React.MutableRefObject<string | undefined>
	userRespondedRef: React.MutableRefObject<boolean>
	enterUserBrowsingHistory: (source: ScrollFollowDisengageSource) => void
}

export function useChatAreaEffects(params: UseChatAreaEffectsParams): void {
	const {
		isHidden,
		messages,
		currentTaskItem,
		currentTaskItemId,
		messageQueue,
		ui,
		t,
		playSound,
		store,
		currentAsk,
		showScrollToBottom,
		visibleMessages,
		modifiedMessagesLength,
		isStreaming,
		messagesRef,
		currentAskRef,
		userRespondedRef,
		enterUserBrowsingHistory,
	} = params

	const everVisibleMessagesTsRef = useRef<LRUCache<number, boolean>>(new LRUCache({ max: 100, ttl: 1000 * 60 * 5 }))
	const prevExpandedRowsRef = useRef<Record<number, boolean>>({})

	useEffect(() => {
		messagesRef.current = messages
	}, [messages, messagesRef])

	useEffect(() => {
		currentAskRef.current = currentAsk
	}, [currentAsk, currentAskRef])

	useEffect(() => {
		if (!messages || messages.length === 0) {
			store.ask.resetAskState()
			return
		}
		const soundType = store.ask.processAskMessage(
			messages,
			currentTaskItem,
			messageQueue,
			ui.textArea.inputValue,
			t,
		)
		if (soundType) playSound(soundType)
	}, [messages, currentTaskItem, messageQueue, ui.textArea.inputValue, t, playSound, store.ask])

	useEffect(() => {
		if (
			ui.currentAsk === "resume_task" &&
			currentTaskItem &&
			"parentTaskId" in (currentTaskItem as Record<string, unknown>)
		) {
			store.ask.updateResumeTaskButton(messages, currentTaskItem, t)
		}
	}, [messages, currentTaskItem, ui.currentAsk, t, store.ask])

	useEffect(() => {
		if (ui.isFollowUpAutoApprovalPaused) store.cancelAutoApproval()
	}, [ui.isFollowUpAutoApprovalPaused, store])

	useEffect(() => {
		ui.resetTaskUI()
		userRespondedRef.current = false
	}, [currentTaskItemId, ui, userRespondedRef])

	useEffect(() => {
		if (
			currentTaskItem &&
			"childIds" in (currentTaskItem as Record<string, unknown>) &&
			(currentTaskItem as { childIds?: string[] }).childIds?.length
		) {
			store.getTaskWithAggregatedCosts((currentTaskItem as { id: string }).id)
		}
	}, [currentTaskItem, store])

	useEffect(() => {
		ui.setShowScrollToBottom(showScrollToBottom)
	}, [showScrollToBottom, ui])

	useEffect(() => {
		if (isHidden) everVisibleMessagesTsRef.current.clear()
	}, [isHidden])

	useEffect(() => {
		const i = setInterval(() => {
			visibleMessages.forEach((msg) => everVisibleMessagesTsRef.current.set(msg.ts, true))
		}, 500)
		return () => clearInterval(i)
	}, [visibleMessages])

	useDebounceEffect(
		() => {
			const cache = everVisibleMessagesTsRef.current
			const last = visibleMessages.at(-1)
			if (last && cache.has(last.ts)) {
				const lastSeenTs = Array.from(cache.keys()).sort((a, b) => b - a)[0]
				if (lastSeenTs) store.acknowledgeLastMessageSeen(String(lastSeenTs))
			}
		},
		2000,
		[visibleMessages.length, store],
	)

	useEffect(() => {
		const wasAnyRowExpandedByUser = Object.entries(ui.expandedRows).some(
			([tsKey, isExpanded]) => isExpanded && !(prevExpandedRowsRef.current[Number(tsKey)] ?? false),
		)
		if (wasAnyRowExpandedByUser) enterUserBrowsingHistory("row-expansion")
		prevExpandedRowsRef.current = { ...ui.expandedRows }
	}, [enterUserBrowsingHistory, ui.expandedRows])

	useEffect(() => {
		if (isHidden || !currentTaskItem) ui.setCheckpointWarning(undefined)
	}, [modifiedMessagesLength, isStreaming, isHidden, currentTaskItem, ui])
}
