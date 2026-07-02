import type React from "react"
import type { Notification, AskResponseValue, TodoItem, SuggestionItem } from "@jabberwock/types"
import { isAlive, isStateTreeNode } from "mobx-state-tree"
import { getLatestTodo } from "@shared/misc/todo"

export interface ChatNode {
	uiMessages?: unknown[] | Notification[]
	messages?: Notification[]
	parentId?: string
}

/** Runtime instance type for MST TaskNode (wider shape). */
export type TaskNodeInstance = ChatNode & {
	id: string
	title: string
	mode: string
	status: string
	children: string[]
	rootId: string
}

export const hasNewerExtensionMessages = (extensionMessages: Notification[], sourceTs: number): boolean =>
	extensionMessages.length > 0 && (extensionMessages.at(-1)?.ts ?? 0) > sourceTs

const getNodeLatestTs = (node: ChatNode, hasUiMessages: boolean, hasRawMessages: number): number =>
	hasUiMessages
		? ((node.uiMessages as Notification[]).at(-1)?.ts ?? 0)
		: hasRawMessages
			? ((node.messages as Notification[]).at(-1)?.ts ?? 0)
			: 0

const getFallbackMessages = (
	tree: { isNavigating: boolean },
	messagesRef: React.MutableRefObject<Notification[]>,
	extensionMessages: Notification[],
): Notification[] =>
	tree.isNavigating && messagesRef.current.length > 0 ? messagesRef.current : extensionMessages || []

const getNodeMessages = (node: ChatNode, extensionMessages: Notification[]): Notification[] | null => {
	if (!isAlive(node)) return extensionMessages.length > 0 ? extensionMessages : []
	const uiMessages = node.uiMessages as Notification[] | undefined
	const rawMessages = node.messages as Notification[] | undefined
	const hasUiMessages = !!(uiMessages && uiMessages.length > 0)
	const hasRawMessages = !!(rawMessages && rawMessages.length > 0)
	const hasNewer = hasNewerExtensionMessages(
		extensionMessages,
		getNodeLatestTs(node, hasUiMessages, hasRawMessages ? 1 : 0),
	)
	if (hasNewer) return extensionMessages
	if (hasUiMessages) return uiMessages
	if (hasRawMessages) return rawMessages
	return null
}

export const computeTreeMessages = (
	currentTaskItemId: string | undefined,
	nodes: Map<string, ChatNode | TaskNodeInstance>,
	extensionMessages: Notification[],
	tree: { isNavigating: boolean },
	messagesRef: React.MutableRefObject<Notification[]>,
): Notification[] => {
	if (!currentTaskItemId) return getFallbackMessages(tree, messagesRef, extensionMessages)
	const node = nodes.get(currentTaskItemId)
	if (!node) return getFallbackMessages(tree, messagesRef, extensionMessages)
	const nodeMessages = getNodeMessages(node, extensionMessages)
	return nodeMessages ?? getFallbackMessages(tree, messagesRef, extensionMessages)
}

export const isSendBlocked = (
	sendingDisabled: boolean,
	isStreaming: boolean,
	hasQueuedMessages: boolean,
	isCommandOutput: boolean,
): boolean => sendingDisabled || isStreaming || hasQueuedMessages || isCommandOutput

export const handleAskResponse = (
	currentAsk: string,
	text: string,
	images: string[],
	markFollowUpAsAnswered: () => void,
	respondToAsk: (response: AskResponseValue, text?: string, images?: string[]) => void,
): void => {
	if (currentAsk === "followup") markFollowUpAsAnswered()
	respondToAsk("messageResponse", text, images)
}

export const computeParentNode = (
	currentNodeId: string | undefined,
	currentTaskItem: { id: string; parentTaskId?: string } | undefined,
	nodes: Map<string, ChatNode | TaskNodeInstance>,
): ChatNode | undefined => {
	const effectiveNodeId = currentNodeId || currentTaskItem?.id
	if (!effectiveNodeId) return undefined
	const activeNode = nodes.get(effectiveNodeId)
	if (!activeNode) return undefined
	const parentNodeId = activeNode.parentId || currentTaskItem?.parentTaskId
	return parentNodeId ? nodes.get(parentNodeId) : undefined
}

export const computeLatestTodos = (messages: Notification[], currentTaskTodos: TodoItem[] | undefined): TodoItem[] => {
	if (currentTaskTodos?.length) {
		const t = getLatestTodo(messages)
		return t?.length ? t : currentTaskTodos
	}
	if (isStateTreeNode(messages) && !isAlive(messages)) return []
	return getLatestTodo(messages)
}

export const getAudioVolume = (soundVolume: unknown): number => (typeof soundVolume === "number" ? soundVolume : 0.5)

export const getVirtuosoKey = (taskId: string | undefined): string => taskId ?? "no-task"

export function isInputEmpty(text: string, images: string[]): boolean {
	return !text.trim() && images.length === 0
}

export function handleModeNavigation(
	suggestion: SuggestionItem,
	event: React.MouseEvent | undefined,
	alwaysAllowModeSwitch: boolean | undefined,
	navigateToTask: (id: string) => void,
) {
	if (suggestion.mode && (event || alwaysAllowModeSwitch)) navigateToTask(suggestion.id || "")
}
