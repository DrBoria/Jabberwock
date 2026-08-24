import type { Goal, WebviewMessage, HistoryItem, Notification, ModelInfo, TodoItem } from "@jabberwock/types"
import { eventConstants } from "@jabberwock/types"
import { findLastIndex } from "@shared/array"
import { getModelMaxOutputTokens } from "@shared/api"
import { getLatestTodo } from "@shared/misc/todo"
import { rootStore } from "@src/features/store"
import type { IChatStore } from "@src/features/chat/tree/store"

export function isInteractiveElement(target: EventTarget): boolean {
	if (!(target instanceof Element)) return false
	return !!(
		target.closest("button") ||
		target.closest('[role="button"]') ||
		target.closest(".share-button") ||
		target.closest("[data-radix-popper-content-wrapper]") ||
		target.closest("img") ||
		target.tagName === "IMG"
	)
}

export function hasTextSelection(): boolean {
	const selection = window.getSelection()
	return !!(selection && selection.toString().length > 0)
}

export function isTaskCompleteMessage(messages: Notification[]): boolean {
	if (!messages || messages.length === 0) return false
	const lastRelevantIndex = findLastIndex(
		messages,
		(m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"),
	)
	return lastRelevantIndex !== -1 ? messages[lastRelevantIndex]?.ask === "completion_result" : false
}

export function computeCostBreakdown(
	tokensIn: number | undefined,
	tokensOut: number | undefined,
	cacheWrites: number | undefined,
	cacheReads: number | undefined,
): string | undefined {
	const details: string[] = []
	if (tokensIn) details.push(`↑${tokensIn} in`)
	if (tokensOut) details.push(`↓${tokensOut} out`)
	if (cacheWrites) details.push(`CW:${cacheWrites}`)
	if (cacheReads) details.push(`CR:${cacheReads}`)
	return details.length > 0 ? details.join(" ") : undefined
}

interface TaskNodeLike {
	messages?: Array<{ say: string; images?: string[] }>
}

export function getTaskImages(currentNodeId: string | undefined, nodes: IChatStore["nodes"]): string[] {
	if (!currentNodeId || !nodes.has(currentNodeId)) return []
	const node = nodes.get(currentNodeId) as TaskNodeLike | undefined
	const firstTextMessage = node?.messages?.find((m) => m.say === "text")
	return firstTextMessage?.images || []
}

export function getAggregatedCost(
	currentNodeId: string | undefined,
	aggregatedCostsMap: Map<string, { totalCost: number; ownCost: number; childrenCost: number }>,
): number | undefined {
	return currentNodeId && aggregatedCostsMap.has(currentNodeId)
		? (aggregatedCostsMap.get(currentNodeId)!.totalCost as number)
		: undefined
}

export function subtaskExists(
	currentNodeId: string | undefined,
	aggregatedCostsMap: Map<string, { totalCost: number; ownCost: number; childrenCost: number }>,
): boolean {
	return !!(
		currentNodeId &&
		aggregatedCostsMap.has(currentNodeId) &&
		(aggregatedCostsMap.get(currentNodeId)!.childrenCost as number) > 0
	)
}

export function computeTodos(messages: Notification[]): TodoItem[] | undefined {
	const extensionTodos = rootStore.extensionState.currentTaskTodos
	if (extensionTodos && extensionTodos.length > 0) {
		const messageBasedTodos = getLatestTodo(messages)
		if (messageBasedTodos && messageBasedTodos.length > 0) return messageBasedTodos
		return extensionTodos
	}
	return getLatestTodo(messages)
}

export function shouldIgnoreCardClick(e: React.MouseEvent): boolean {
	if (e.target instanceof Element && e.target.closest("[data-todo-list]")) return true
	if (isInteractiveElement(e.target)) return true
	if (hasTextSelection()) return true
	return false
}

export function syncEditableGoals(
	isEditingGoals: boolean,
	goals: Goal[],
	setEditableGoals: (goals: Goal[] | ((prev: Goal[]) => Goal[])) => void,
): void {
	if (isEditingGoals) {
		setEditableGoals(goals.map((g) => ({ ...g })))
	}
}

export function showLongRunningMessage(
	currentTaskItem: HistoryItem | undefined,
	isTaskComplete: boolean,
	setShowLongRunningTaskMessage: (v: boolean) => void,
): () => void {
	const timer = setTimeout(() => {
		if (currentTaskItem && !isTaskComplete) {
			setShowLongRunningTaskMessage(true)
		}
	}, 120_000)
	return () => clearTimeout(timer)
}

export function getCurrentNodeId(
	tree: { activeNodeId?: { id?: string } | null },
	currentTaskItem?: { id?: string } | null,
): string | undefined {
	return tree.activeNodeId?.id || currentTaskItem?.id
}

export function getSafeContextWindow(model: { contextWindow?: number } | null | undefined): number {
	return model?.contextWindow || 1
}

export function getSafeTaskText(currentTaskItem?: { task?: string } | null): string {
	return currentTaskItem?.task ?? ""
}

export function getIsSubtask(currentTaskItem?: { parentTaskId?: string } | null): boolean {
	return !!currentTaskItem?.parentTaskId
}

export function hasTodosValue(todos: unknown[] | undefined): boolean {
	return !!(todos && Array.isArray(todos) && todos.length > 0)
}

export function goBackToParent(
	activeWindows: { length: number },
	popWindow: () => void,
	parentTaskId: string | undefined,
): void {
	if (activeWindows.length > 1) {
		popWindow()
	} else if (parentTaskId) {
		rootStore.chat.navigateToTask(parentTaskId)
	}
}

export function extractGoals(currentTaskItem: HistoryItem | undefined): Goal[] {
	return currentTaskItem?.goals ?? []
}

export function buildGoalUpdateMessage(id: string, partial: Partial<Goal>): WebviewMessage {
	return {
		type: eventConstants.CHAT.TASK.GOAL_UPDATE,
		id,
		...(partial.text !== undefined ? { text: partial.text } : {}),
		...(partial.importance !== undefined ? { importance: partial.importance } : {}),
	} satisfies WebviewMessage
}

export function computeMaxTokens(
	model: ModelInfo | undefined | null,
	modelId: string | undefined,
	apiConfiguration: Record<string, unknown> | undefined,
): number {
	if (!model || !modelId) return 0
	return (
		getModelMaxOutputTokens({
			modelId,
			model,
			settings: apiConfiguration,
		}) ?? 0
	)
}
