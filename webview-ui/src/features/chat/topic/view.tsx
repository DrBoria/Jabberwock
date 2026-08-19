import { useState, useMemo, useCallback } from "react"
import { observer } from "mobx-react-lite"
import { useChatTree } from "@/features/chat/tree/store"
import { useSelectedModel } from "@/features/foundation/ui/hooks/useSelectedModel/useSelectedModel"
import { useWindowManager } from "@/features/foundation/window-manager/store"
import { useChatUI } from "@/features/chat/store"
import { useCloudUpsell } from "@src/hooks/useCloudUpsell"
import { IconButton } from "@src/shared/ui/buttons/icon-button"
import { FoldVertical } from "lucide-react"
import { TaskHeaderView } from "./view/task-header-view"
import {
	computeCostBreakdown,
	computeIsTaskComplete,
	computeMaxTokens,
	computeTaskImages,
	computeAggregatedCost,
	computeHasSubtasks,
	computeTodos,
	computeHasTodos,
	handleCardClickHelper,
	handleBackToParentHelper,
	useLongRunningTaskMessage,
	getActiveNodeId,
	getContextWindow,
	getTaskText,
	toZero,
	hasParentTask,
	handleCondenseClick,
} from "./view/helpers"
import { rootStore } from "@src/features/store"

const TaskHeaderComponent = () => {
	const { apiConfiguration, currentTaskItem, messages } = rootStore.extensionState
	const tree = useChatTree()
	const nodes = useMemo(() => new Map(tree.nodes.entries()), [tree.nodes])
	const currentNodeId = getActiveNodeId(tree, currentTaskItem)
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
	const { isOpen, openUpsell, closeUpsell, handleConnect } = useCloudUpsell({ autoOpenOnAuth: false })
	const isTaskComplete = useMemo(() => computeIsTaskComplete(messages), [messages])
	const [showLongRunningTaskMessage] = useLongRunningTaskMessage(currentTaskItem, isTaskComplete)
	const contextWindow = getContextWindow(model)
	const maxTokens = useMemo(
		() => computeMaxTokens(model, modelId, apiConfiguration),
		[model, modelId, apiConfiguration],
	)
	const taskText = getTaskText(currentTaskItem)
	const taskImages = useMemo(() => computeTaskImages(currentNodeId, nodes), [currentNodeId, nodes])
	const aggregatedCost = useMemo(
		() => computeAggregatedCost(currentNodeId, ui.aggregatedCostsMap),
		[currentNodeId, ui.aggregatedCostsMap],
	)
	const hasSubtasks = useMemo(
		() => computeHasSubtasks(currentNodeId, ui.aggregatedCostsMap),
		[currentNodeId, ui.aggregatedCostsMap],
	)
	const todos = useMemo(() => computeTodos(messages), [messages])
	const hasTodos = computeHasTodos(todos)
	const isSubtask = hasParentTask(currentTaskItem)
	const handleCardClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => handleCardClickHelper(e, setIsTaskExpanded),
		[],
	)
	const handleBackToParent = useCallback(
		() => handleBackToParentHelper(activeWindows, popWindow, currentTaskItem),
		[activeWindows, popWindow, currentTaskItem],
	)
	const handleCondense = useCallback(() => handleCondenseClick(currentTaskItem), [currentTaskItem])
	const condenseButton = (
		<IconButton title="Condense Context" icon={FoldVertical} disabled={buttonsDisabled} onClick={handleCondense} />
	)

	return (
		<TaskHeaderView
			isSubtask={isSubtask}
			handleBackToParent={handleBackToParent}
			showLongRunningTaskMessage={showLongRunningTaskMessage}
			isTaskComplete={isTaskComplete}
			openUpsell={openUpsell}
			closeUpsell={closeUpsell}
			handleConnect={handleConnect}
			isOpen={isOpen}
			hasTodos={hasTodos}
			handleCardClick={handleCardClick}
			isTaskExpanded={isTaskExpanded}
			setIsTaskExpanded={setIsTaskExpanded}
			taskText={taskText}
			contextWindow={contextWindow}
			contextTokens={toZero(contextTokens)}
			reservedForOutput={toZero(maxTokens)}
			totalCost={totalCost}
			aggregatedCost={aggregatedCost}
			hasSubtasks={hasSubtasks}
			costBreakdown={costBreakdown}
			condenseButton={condenseButton}
			taskImages={taskImages}
			currentTaskItem={currentTaskItem}
			buttonsDisabled={buttonsDisabled}
			maxTokens={toZero(maxTokens)}
			tokensIn={tokensIn}
			tokensOut={tokensOut}
			cacheReads={cacheReads}
			cacheWrites={cacheWrites}
			nodes={nodes}
			pushWindow={pushWindow}
			todos={todos}
		/>
	)
}

const TaskHeader = observer(TaskHeaderComponent)
export default TaskHeader
