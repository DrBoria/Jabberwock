import { useMemo, useRef, useCallback } from "react"
import type { VirtuosoHandle } from "react-virtuoso"
import type { Notification } from "@jabberwock/types"
import { useChatUI } from "@src/features/chat/store"
import { useChatTree } from "@src/features/chat/tree/store"
import { rootStore } from "@src/features/store"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useStreamingStore } from "@src/features/api/streaming"
import { useScrollLifecycle } from "@src/hooks/scroll-lifecycle/useScrollLifecycle"
import { computeVisibleMessages } from "@src/features/chat/task/messages/components/utils/visible-messages"
import { computeGroupedMessages } from "@src/features/chat/task/messages/components/utils/grouped-messages"
import { combineApiRequests } from "@shared/api/combineApiRequests"
import { combineCommandSequences } from "@shared/combineCommandSequences"
import {
	getVirtuosoKey,
	computeTreeMessages,
	computeParentNode,
	computeLatestTodos,
	type TaskNodeInstance,
} from "./message-area.utils"
import { useChatAreaEffects } from "./message-area.effects"
import { useMessageSound } from "../hooks/message-area-sound.hooks"
import { filterPartialMessages } from "../responders/filter-partial-messages"
import { useChatAreaCallbacks } from "./useChatAreaCallbacks"
import type { UseChatAreaReturn } from "./chatArea.types"

export type { UseChatAreaReturn }

export const useChatArea = (isHidden: boolean): UseChatAreaReturn => {
	const ui = useChatUI()
	const tree = useChatTree()
	const store = rootStore.chat
	const diagnostics = rootStore.extensionState.diagnostics
	const {
		currentTaskItem,
		messages: extensionMessages,
		messageQueue = [],
		alwaysAllowModeSwitch,
		soundEnabled = false,
		soundVolume,
	} = rootStore.extensionState
	const { t } = useAppTranslation()
	const currentNodeId = tree.activeNodeId?.id
	const nodes = useMemo(() => new Map(tree.nodes.entries()) as unknown as Map<string, TaskNodeInstance>, [tree.nodes])
	const { playSound } = useMessageSound(soundVolume, soundEnabled)
	const messagesRef = useRef<Notification[]>([])
	const treeMessages = useMemo(
		() => computeTreeMessages(currentTaskItem?.id, nodes, extensionMessages, tree, messagesRef),
		[currentTaskItem?.id, nodes, extensionMessages, tree],
	)
	const streamingState = useStreamingStore()
	const messages = useMemo(
		() => filterPartialMessages(treeMessages, streamingState.isActive),
		[treeMessages, streamingState.isActive],
	)
	const virtuosoRef = useRef<VirtuosoHandle>(null!)
	const scrollContainerRef = useRef<HTMLDivElement>(null!)
	const userRespondedRef = useRef(false)
	const modifiedMessages = useMemo(() => combineApiRequests(combineCommandSequences(messages.slice(1))), [messages])
	const currentAsk = ui.currentAsk
	const isStreaming = ui.isStreaming
	const currentAskRef = useRef<string | undefined>(currentAsk)
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
	const parentNode = useMemo(
		() => computeParentNode(currentNodeId, currentTaskItem, nodes),
		[currentNodeId, currentTaskItem, nodes],
	)
	const isNested = !!parentNode
	const currentTaskTodos = rootStore.extensionState.currentTaskTodos
	const _latestTodos = useMemo(() => computeLatestTodos(messages, currentTaskTodos), [messages, currentTaskTodos])
	const markFollowUpAsAnswered = useCallback(() => {
		const msg = messagesRef.current.findLast((m: Notification) => m.ask === "followup")
		if (msg) ui.setCurrentFollowUpTs(msg.ts)
	}, [ui])
	const handleChatReset = useCallback(
		(shouldPostMessage = true) => {
			userRespondedRef.current = false
			if (shouldPostMessage) store.clearTask()
			ui.textArea.clearInput()
			store.ask.resetAskState()
		},
		[ui, store],
	)

	const { handlePrimaryButtonClick, handleSecondaryButtonClick, handleSuggestionClickInRow } = useChatAreaCallbacks({
		ui,
		store,
		currentTaskItem,
		currentAsk,
		isStreaming,
		messageQueue,
		messagesRef,
		currentAskRef,
		markFollowUpAsAnswered,
		handleChatReset,
		alwaysAllowModeSwitch,
	})

	const visibleMessages = useMemo(() => computeVisibleMessages(modifiedMessages), [modifiedMessages])
	const virtuosoKey = getVirtuosoKey(currentTaskItem?.id)
	const groupedMessages = useMemo(
		() => computeGroupedMessages(visibleMessages, ui.isCondensing),
		[visibleMessages, ui.isCondensing],
	)
	const latestModifiedMessage = modifiedMessages.at(-1)

	useChatAreaEffects({
		isHidden,
		messages,
		currentTaskItem,
		currentTaskItemId: currentTaskItem?.id,
		messageQueue,
		ui,
		t,
		playSound,
		store,
		currentAsk,
		showScrollToBottom,
		visibleMessages,
		modifiedMessagesLength: modifiedMessages.length,
		isStreaming,
		messagesRef,
		currentAskRef,
		userRespondedRef,
		enterUserBrowsingHistory,
	})

	return {
		parentNode,
		diagnostics,
		isStreaming,
		devtoolEnabled: rootStore.extensionState.devtoolEnabled,
		checkpointWarning: ui.checkpointWarning as
			| { type: "WAIT_TIMEOUT" | "INIT_TIMEOUT"; timeout: number }
			| undefined,
		virtuosoRef,
		scrollContainerRef,
		virtuosoKey,
		groupedMessages,
		followOutputCallback,
		atBottomStateChangeCallback,
		currentNodeId,
		nodes,
		isNested,
		handleRowHeightChange,
		handleSuggestionClickInRow,
		modifiedMessages,
		messages,
		handlePrimaryButtonClick,
		handleSecondaryButtonClick,
		handleScrollToBottomClick,
		latestModifiedMessage,
	}
}
