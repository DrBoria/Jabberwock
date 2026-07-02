import { findLastIndex } from "@shared/array"
import { getModelMaxOutputTokens } from "@shared/api"
import type { ModelInfo, Notification } from "@jabberwock/types"
import { getLatestTodo } from "@shared/misc/todo"
import { rootStore } from "@src/features/store"
import { useState, useEffect } from "react"

const UNITS = ["B", "KB", "MB", "GB", "TB"]

export const prettyBytes = (bytes: number): string => {
	if (bytes <= 0) return "0 B"
	const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
	return `${(bytes / Math.pow(1024, exponent)).toFixed(exponent === 0 ? 0 : 2)} ${UNITS[exponent]}`
}

export const isInteractiveElement = (target: EventTarget | null): boolean => {
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

export const computeCostBreakdown = (
	tokensIn?: number,
	tokensOut?: number,
	cacheWrites?: number,
	cacheReads?: number,
): string | undefined => {
	const details: string[] = []
	if (tokensIn) details.push(`↑${tokensIn} in`)
	if (tokensOut) details.push(`↓${tokensOut} out`)
	if (cacheWrites) details.push(`CW:${cacheWrites}`)
	if (cacheReads) details.push(`CR:${cacheReads}`)
	return details.length > 0 ? details.join(" ") : undefined
}

export const computeIsTaskComplete = (messages: ReadonlyArray<{ ask?: string }> | undefined): boolean => {
	if (!messages || messages.length === 0) return false
	const lastRelevantIndex = findLastIndex(
		messages,
		(m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"),
	)
	return lastRelevantIndex !== -1 ? messages[lastRelevantIndex]?.ask === "completion_result" : false
}

export const computeMaxTokens = (model: ModelInfo | undefined, modelId: string, apiConfiguration: object): number =>
	model ? (getModelMaxOutputTokens({ modelId, model, settings: apiConfiguration }) ?? 0) : 0

export const computeTaskImages = (
	currentNodeId: string | undefined,
	nodes: {
		has(key: string): boolean
		get(key: string): { messages?: Array<{ say?: string; images?: string[] }> } | undefined
	},
): string[] => {
	if (!currentNodeId || !nodes.has(currentNodeId)) return []
	const node = nodes.get(currentNodeId)
	return (node?.messages?.find((m) => m.say === "text")?.images || []) as string[]
}

export const computeAggregatedCost = (
	currentNodeId: string | undefined,
	aggregatedCostsMap: Map<string, { totalCost: number; ownCost: number; childrenCost: number }>,
): number | undefined => {
	if (!currentNodeId || !aggregatedCostsMap.has(currentNodeId)) return undefined
	return aggregatedCostsMap.get(currentNodeId)!.totalCost
}

export const computeHasSubtasks = (
	currentNodeId: string | undefined,
	aggregatedCostsMap: Map<string, { totalCost: number; ownCost: number; childrenCost: number }>,
): boolean => {
	if (!currentNodeId || !aggregatedCostsMap.has(currentNodeId)) return false
	return aggregatedCostsMap.get(currentNodeId)!.childrenCost > 0
}

export const computeTodos = (
	messages: readonly Notification[] | undefined,
): ReadonlyArray<{ id: string; status: string }> | undefined => {
	const extensionTodos = rootStore.extensionState.currentTaskTodos
	if (extensionTodos && extensionTodos.length > 0) {
		const messageBasedTodos = getLatestTodo(messages ?? [])
		if (messageBasedTodos && messageBasedTodos.length > 0) return messageBasedTodos
		return extensionTodos
	}
	return getLatestTodo(messages ?? [])
}

export const computeHasTodos = (todos: ReadonlyArray<unknown> | undefined | null): boolean =>
	!!(todos && Array.isArray(todos) && todos.length > 0)

export const handleCardClickHelper = (
	e: React.MouseEvent<HTMLDivElement>,
	setIsTaskExpanded: (value: ((prev: boolean) => boolean) | boolean) => void,
): void => {
	if (e.target instanceof Element && e.target.closest("[data-todo-list]")) return
	if (isInteractiveElement(e.target)) return
	const selection = window.getSelection()
	if (selection && selection.toString().length > 0) return
	setIsTaskExpanded((v) => !v)
}

export const handleBackToParentHelper = (
	activeWindows: ReadonlyArray<unknown>,
	popWindow: () => void,
	currentTaskItem: { parentTaskId?: string } | undefined,
): void => {
	if (activeWindows.length > 1) popWindow()
	else if (currentTaskItem?.parentTaskId) rootStore.chat.navigateToTask(currentTaskItem.parentTaskId)
}

export const getActiveNodeId = (
	tree: { activeNodeId?: { id?: string } },
	currentTaskItem: { id?: string } | undefined,
): string | undefined => tree.activeNodeId?.id || currentTaskItem?.id
export const getContextWindow = (model: { contextWindow?: number } | undefined): number => model?.contextWindow || 1
export const getTaskText = (currentTaskItem: { task?: string } | undefined): string => currentTaskItem?.task ?? ""
export const toZero = (value: number | undefined): number => value || 0
export const hasParentTask = (currentTaskItem: { parentTaskId?: string } | undefined): boolean =>
	!!currentTaskItem?.parentTaskId
export const handleCondenseClick = (currentTaskItem: { id?: string } | undefined): void => {
	if (currentTaskItem?.id) rootStore.chat.condenseContext(currentTaskItem.id)
}

const LONG_RUNNING_TASK_THRESHOLD_MS = 30_000

export const useLongRunningTaskMessage = (currentTaskItem: unknown, isTaskComplete: boolean): [boolean] => {
	const [showMessage, setShowMessage] = useState(false)
	useEffect(() => {
		if (isTaskComplete) {
			setShowMessage(false)
			return
		}
		const timer = setTimeout(() => setShowMessage(true), LONG_RUNNING_TASK_THRESHOLD_MS)
		return () => clearTimeout(timer)
	}, [currentTaskItem, isTaskComplete])
	return [showMessage]
}
