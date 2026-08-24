import type { Instance } from "mobx-state-tree"
import type { TaskNode } from "@/features/chat/tree/store"
import type { HistoryItem } from "@jabberwock/types"
import { cn } from "@/lib/utils"
import { CloudUpsellDialog } from "@src/features/cloud/components/CloudUpsellDialog"
import { TodoListDisplay } from "../list-display"
import { ExpandedContent } from "./components-expanded"
import {
	TaskCardHeader,
	CollapsedContextBar,
	BackToParentButton,
	LongRunningBanner,
	borderClass,
	ActiveSubAgents,
} from "./task-header-view-components"

interface TaskHeaderViewProps {
	isSubtask: boolean
	handleBackToParent: () => void
	showLongRunningTaskMessage: boolean
	isTaskComplete: boolean
	openUpsell: () => void
	closeUpsell: () => void
	handleConnect: () => void
	isOpen: boolean
	hasTodos: boolean
	handleCardClick: (e: React.MouseEvent<HTMLDivElement>) => void
	isTaskExpanded: boolean
	setIsTaskExpanded: (v: ((prev: boolean) => boolean) | boolean) => void
	taskText: string
	contextWindow: number
	contextTokens: number
	reservedForOutput: number
	totalCost: number | undefined
	aggregatedCost: number | undefined
	hasSubtasks: boolean
	costBreakdown: string | undefined
	condenseButton: React.ReactNode
	taskImages: string[]
	currentTaskItem?: HistoryItem | null
	buttonsDisabled: boolean
	maxTokens: number
	tokensIn: number | undefined
	tokensOut: number | undefined
	cacheReads: number | undefined
	cacheWrites: number | undefined
	nodes: Map<string, Instance<typeof TaskNode>>
	pushWindow: (
		type:
			| "chat"
			| "history"
			| "settings"
			| "marketplace"
			| "cloud"
			| "async_task"
			| "interactive_mcp"
			| "task_hierarchy",
		params?: Record<string, unknown>,
	) => void
	todos: ReadonlyArray<{ id: string; status: string }> | undefined
}

export const TaskHeaderView: React.FC<TaskHeaderViewProps> = ({
	isSubtask,
	handleBackToParent,
	showLongRunningTaskMessage,
	isTaskComplete,
	openUpsell,
	closeUpsell,
	handleConnect,
	isOpen,
	hasTodos,
	handleCardClick,
	isTaskExpanded,
	setIsTaskExpanded,
	taskText,
	contextWindow,
	contextTokens,
	reservedForOutput,
	totalCost,
	aggregatedCost,
	hasSubtasks,
	costBreakdown,
	condenseButton,
	taskImages,
	currentTaskItem,
	buttonsDisabled,
	maxTokens,
	tokensIn,
	tokensOut,
	cacheReads,
	cacheWrites,
	nodes,
	pushWindow,
	todos,
}) => (
	<div className="group pt-2 pb-0 px-3">
		<BackToParentButton isSubtask={isSubtask} onBack={handleBackToParent} />
		<LongRunningBanner show={showLongRunningTaskMessage} isComplete={isTaskComplete} onAction={openUpsell} />
		<div
			className={cn(
				"px-3 pt-2.5 pb-2 flex flex-col gap-1.5 relative z-1 cursor-pointer",
				"bg-vscode-input-background hover:bg-vscode-input-background/90",
				"text-vscode-foreground/80 hover:text-vscode-foreground",
				"shadow-lg shadow-vscode-sideBar-background/50 rounded-xl",
				borderClass(hasTodos),
			)}
			onClick={handleCardClick}>
			<TaskCardHeader isTaskExpanded={isTaskExpanded} setIsTaskExpanded={setIsTaskExpanded} taskText={taskText} />
			{!isTaskExpanded && contextWindow > 0 && (
				<CollapsedContextBar
					contextWindow={contextWindow}
					contextTokens={contextTokens}
					reservedForOutput={reservedForOutput}
					totalCost={totalCost}
					aggregatedCost={aggregatedCost}
					hasSubtasks={hasSubtasks}
					costBreakdown={costBreakdown}
				/>
			)}
			{isTaskExpanded && (
				<ExpandedContent
					taskText={taskText}
					taskImages={taskImages}
					currentTaskItem={currentTaskItem}
					buttonsDisabled={buttonsDisabled}
					contextWindow={contextWindow}
					contextTokens={contextTokens}
					maxTokens={maxTokens}
					tokensIn={tokensIn}
					tokensOut={tokensOut}
					cacheReads={cacheReads}
					cacheWrites={cacheWrites}
					totalCost={totalCost}
					aggregatedCost={aggregatedCost}
					hasSubtasks={hasSubtasks}
					costBreakdown={costBreakdown}
					condenseButton={condenseButton}
				/>
			)}
			{hasTodos && todos && (
				<TodoListDisplay
					todos={[...todos]}
					onTodoClick={(taskId) => pushWindow("chat", { targetNodeId: taskId })}
				/>
			)}
			<ActiveSubAgents nodes={nodes} currentTaskId={currentTaskItem?.id} pushWindow={pushWindow} />
		</div>
		<CloudUpsellDialog open={isOpen} onOpenChange={closeUpsell} onConnect={handleConnect} />
	</div>
)
