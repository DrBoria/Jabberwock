import { useEffect, useRef, useState, useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import type { Goal } from "@jabberwock/types"
import { eventConstants } from "@jabberwock/types"
import { vscode } from "@jabberwock/devtool/webview"
import { FoldVertical } from "lucide-react"
import { useCloudUpsell } from "@src/hooks/useCloudUpsell"
import { useSelectedModel } from "@/features/foundation/ui/hooks/useSelectedModel/useSelectedModel"
import { useChatTree } from "@src/features/chat/tree/store"
import { useWindowManager } from "@src/features/foundation/window-manager/store"
import { rootStore } from "@src/features/store"
import { useChatUI } from "@src/features/chat/store"
import { IconButton } from "@src/shared/ui/buttons/icon-button"
import { TaskCardBody } from "./panels"
import {
	getCurrentNodeId,
	getSafeContextWindow,
	getSafeTaskText,
	getTaskImages,
	getAggregatedCost,
	subtaskExists,
	computeTodos,
	computeCostBreakdown,
	computeMaxTokens,
	shouldIgnoreCardClick,
	syncEditableGoals,
	showLongRunningMessage,
	getIsSubtask,
	hasTodosValue,
	goBackToParent,
	extractGoals,
	buildGoalUpdateMessage,
	isTaskCompleteMessage,
} from "./utils"

const TaskHeaderComponent = () => {
	const { t } = useTranslation()
	const { apiConfiguration, currentTaskItem, messages } = rootStore.extensionState
	const tree = useChatTree()
	const { nodes } = tree
	const currentNodeId = getCurrentNodeId(tree, currentTaskItem)
	const { id: modelId, info: model } = useSelectedModel(apiConfiguration)
	const { pushWindow, popWindow, activeWindows } = useWindowManager()
	const ui = useChatUI()
	const { apiMetrics } = ui
	const {
		totalTokensIn: tokensIn,
		totalTokensOut: tokensOut,
		totalCacheWrites: cacheWrites,
		totalCacheReads: cacheReads,
		totalCost,
		contextTokens,
	} = apiMetrics
	const buttonsDisabled = ui.textArea.sendingDisabled
	const costBreakdown = useMemo(
		() => computeCostBreakdown(tokensIn, tokensOut, cacheWrites, cacheReads),
		[tokensIn, tokensOut, cacheWrites, cacheReads],
	)
	const [isTaskExpanded, setIsTaskExpanded] = useState(false)
	const [showLongRunningTaskMessage, setShowLongRunningTaskMessage] = useState(false)
	const { isOpen, openUpsell, closeUpsell, handleConnect } = useCloudUpsell({ autoOpenOnAuth: false })
	const [isEditingGoals, setIsEditingGoals] = useState(false)
	const [editableGoals, setEditableGoals] = useState<Goal[]>([])
	const goals = useMemo(() => extractGoals(currentTaskItem), [currentTaskItem])

	useEffect(() => {
		syncEditableGoals(isEditingGoals, goals, setEditableGoals)
	}, [isEditingGoals, goals])

	const handleAddGoal = useCallback(
		(text: string) => {
			setEditableGoals((prev) => [
				...prev,
				{ id: crypto.randomUUID(), text, ts: Date.now(), version: 1, order: editableGoals.length },
			])
			vscode.postMessage({ type: eventConstants.CHAT.TASK.GOAL_ADD, text })
		},
		[editableGoals.length],
	)

	const handleRemoveGoal = useCallback((id: string) => {
		setEditableGoals((prev) => prev.filter((g) => g.id !== id))
		vscode.postMessage({ type: eventConstants.CHAT.TASK.GOAL_REMOVE, id })
	}, [])

	const handleUpdateGoal = useCallback((id: string, partial: Partial<Goal>) => {
		setEditableGoals((prev) =>
			prev.map((g) => (g.id === id ? { ...g, ...partial, id: g.id, version: g.version + 1, ts: Date.now() } : g)),
		)
		vscode.postMessage(buildGoalUpdateMessage(id, partial))
	}, [])

	const handleReorderGoals = useCallback((fromIndex: number, toIndex: number) => {
		setEditableGoals((prev) => {
			const next = [...prev]
			const [moved] = next.splice(fromIndex, 1)
			next.splice(toIndex, 0, moved)
			return next.map((g, i) => ({ ...g, order: i }))
		})
	}, [])

	const textContainerRef = useRef<HTMLDivElement>(null)
	const textRef = useRef<HTMLDivElement>(null)
	const isTaskComplete = isTaskCompleteMessage(messages)
	const contextWindow = getSafeContextWindow(model)
	const maxTokens = useMemo(
		() => computeMaxTokens(model, modelId, apiConfiguration),
		[model, modelId, apiConfiguration],
	)
	const reservedForOutput = maxTokens || 0

	useEffect(
		() => showLongRunningMessage(currentTaskItem, isTaskComplete, setShowLongRunningTaskMessage),
		[currentTaskItem, isTaskComplete],
	)

	const taskText = getSafeTaskText(currentTaskItem)
	const taskImages = useMemo(() => getTaskImages(currentNodeId, nodes), [currentNodeId, nodes])
	const aggregatedCost = useMemo(
		() => getAggregatedCost(currentNodeId, ui.aggregatedCostsMap),
		[currentNodeId, ui.aggregatedCostsMap],
	)
	const hasSubtasks = useMemo(
		() => subtaskExists(currentNodeId, ui.aggregatedCostsMap),
		[currentNodeId, ui.aggregatedCostsMap],
	)
	const todos = useMemo(() => computeTodos(messages), [messages])
	const condenseButton = (
		<IconButton
			title={t("chat:task.condenseContext")}
			icon={FoldVertical}
			disabled={buttonsDisabled}
			onClick={() => {
				if (currentTaskItem) rootStore.chat.condenseContext(currentTaskItem.id)
			}}
		/>
	)
	const hasTodos = hasTodosValue(todos)
	const isSubtask = getIsSubtask(currentTaskItem)
	const handleBackToParent = () => goBackToParent(activeWindows, popWindow, currentTaskItem?.parentTaskId)
	const handleCardClick = useCallback(
		(e: React.MouseEvent) => {
			if (shouldIgnoreCardClick(e)) return
			setIsTaskExpanded((prev) => !prev)
		},
		[setIsTaskExpanded],
	)

	return (
		<TaskCardBody
			isTaskExpanded={isTaskExpanded}
			setIsTaskExpanded={setIsTaskExpanded}
			goals={goals}
			taskText={taskText}
			t={t}
			contextWindow={contextWindow}
			contextTokens={contextTokens || 0}
			reservedForOutput={reservedForOutput}
			totalCost={totalCost}
			hasSubtasks={hasSubtasks}
			aggregatedCost={aggregatedCost}
			costBreakdown={costBreakdown}
			textContainerRef={textContainerRef}
			textRef={textRef}
			taskImages={taskImages}
			isEditingGoals={isEditingGoals}
			editableGoals={editableGoals}
			handleAddGoal={handleAddGoal}
			handleRemoveGoal={handleRemoveGoal}
			handleUpdateGoal={handleUpdateGoal}
			handleReorderGoals={handleReorderGoals}
			setIsEditingGoals={setIsEditingGoals}
			currentTaskItem={currentTaskItem}
			buttonsDisabled={buttonsDisabled}
			maxTokens={maxTokens}
			condenseButton={condenseButton}
			tokensIn={tokensIn}
			tokensOut={tokensOut}
			cacheReads={cacheReads}
			cacheWrites={cacheWrites}
			hasTodos={hasTodos}
			todos={todos}
			nodes={nodes}
			currentTaskItemId={currentTaskItem?.id}
			pushWindow={pushWindow}
			isSubtask={isSubtask}
			handleBackToParent={handleBackToParent}
			handleCardClick={handleCardClick}
			isOpen={isOpen}
			openUpsell={openUpsell}
			closeUpsell={closeUpsell}
			handleConnect={handleConnect}
			showLongRunningTaskMessage={showLongRunningTaskMessage}
			isTaskComplete={isTaskComplete}
		/>
	)
}

const TaskHeader = observer(TaskHeaderComponent)
export default TaskHeader
