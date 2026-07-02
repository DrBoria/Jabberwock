import type { Goal, HistoryItem, TodoItem } from "@jabberwock/types"
import { ArrowLeft } from "lucide-react"
import { cn } from "@src/lib/utils"
import { Button } from "@src/shared/ui/buttons/button"
import type { IChatStore } from "@src/features/chat/tree/store"
import type { WindowTypeValue } from "@src/features/foundation/window-manager/store"
import { TodoListDisplay } from "@src/features/chat/topic/list-display"
import { CloudUpsellDialog } from "@src/features/cloud/components/CloudUpsellDialog"
import DismissibleUpsell from "@src/features/foundation/components/ui/display/DismissibleUpsell"
import { CollapsedTaskBar } from "../task-metrics/collapsed-bar"
import { TaskCardHeader } from "./card-header"
import { ExpandedTaskSection } from "./expanded-section"
import { ActiveSubagentsList } from "./subagents-list"

interface TaskCardBodyProps {
	isTaskExpanded: boolean
	setIsTaskExpanded: (v: boolean) => void
	goals: Goal[]
	taskText: string
	t: (key: string) => string
	contextWindow: number
	contextTokens: number
	reservedForOutput: number
	totalCost: number | undefined
	hasSubtasks: boolean
	aggregatedCost: number | undefined
	costBreakdown: string | undefined
	textContainerRef: React.RefObject<HTMLDivElement>
	textRef: React.RefObject<HTMLDivElement>
	taskImages: string[]
	isEditingGoals: boolean
	editableGoals: Goal[]
	handleAddGoal: (text: string) => void
	handleRemoveGoal: (id: string) => void
	handleUpdateGoal: (id: string, partial: Partial<Goal>) => void
	handleReorderGoals: (fromIndex: number, toIndex: number) => void
	setIsEditingGoals: (v: boolean) => void
	currentTaskItem: HistoryItem | undefined
	buttonsDisabled: boolean
	maxTokens: number
	condenseButton: React.ReactNode
	tokensIn: number | undefined
	tokensOut: number | undefined
	cacheReads: number | undefined
	cacheWrites: number | undefined
	hasTodos: boolean
	todos: TodoItem[] | undefined
	nodes: IChatStore["nodes"]
	currentTaskItemId: string | undefined
	pushWindow: (name: WindowTypeValue, params?: Record<string, unknown>) => void
	isSubtask: boolean
	handleBackToParent: () => void
	handleCardClick: (e: React.MouseEvent) => void
	isOpen: boolean
	openUpsell: () => void
	closeUpsell: () => void
	handleConnect: () => void
	showLongRunningTaskMessage: boolean
	isTaskComplete: boolean
}

export const TaskCardBody = ({
	isTaskExpanded,
	setIsTaskExpanded,
	goals,
	taskText,
	t,
	contextWindow,
	contextTokens,
	reservedForOutput,
	totalCost,
	hasSubtasks,
	aggregatedCost,
	costBreakdown,
	textContainerRef,
	textRef,
	taskImages,
	isEditingGoals,
	editableGoals,
	handleAddGoal,
	handleRemoveGoal,
	handleUpdateGoal,
	handleReorderGoals,
	setIsEditingGoals,
	currentTaskItem,
	buttonsDisabled,
	maxTokens,
	condenseButton,
	tokensIn,
	tokensOut,
	cacheReads,
	cacheWrites,
	hasTodos,
	todos,
	nodes,
	currentTaskItemId,
	pushWindow,
	isSubtask,
	handleBackToParent,
	handleCardClick,
	isOpen,
	openUpsell,
	closeUpsell,
	handleConnect,
	showLongRunningTaskMessage,
	isTaskComplete,
}: TaskCardBodyProps) => (
	<div className="group pt-2 pb-0 px-3">
		{isSubtask && (
			<div className="mb-2" onClick={(e) => e.stopPropagation()}>
				<Button
					variant="link"
					size="sm"
					onClick={handleBackToParent}
					className="flex items-center gap-1.5 p-0 h-auto text-xs text-vscode-textLink-foreground hover:brightness-125 transition-all">
					<ArrowLeft className="size-3" />
					{t("chat:task.backToParentTask")}
				</Button>
			</div>
		)}
		{showLongRunningTaskMessage && !isTaskComplete && (
			<DismissibleUpsell
				upsellId="longRunningTask"
				onClick={() => openUpsell()}
				dismissOnClick={false}
				variant="banner">
				{t("cloud:upsell.longRunningTask")}
			</DismissibleUpsell>
		)}
		<div
			className={cn(
				"px-3 pt-2.5 pb-2 flex flex-col gap-1.5 relative z-1 cursor-pointer",
				"bg-vscode-input-background hover:bg-vscode-input-background/90",
				"text-vscode-foreground/80 hover:text-vscode-foreground",
				"shadow-lg shadow-vscode-sideBar-background/50 rounded-xl",
				hasTodos && "border-b-0",
			)}
			onClick={handleCardClick}>
			<TaskCardHeader
				isTaskExpanded={isTaskExpanded}
				setIsTaskExpanded={setIsTaskExpanded}
				goals={goals}
				taskText={taskText}
				t={t}
			/>
			<CollapsedTaskBar
				contextWindow={contextWindow}
				contextTokens={contextTokens || 0}
				reservedForOutput={reservedForOutput}
				totalCost={totalCost}
				hasSubtasks={hasSubtasks}
				aggregatedCost={aggregatedCost}
				costBreakdown={costBreakdown}
			/>
			<ExpandedTaskSection
				taskText={taskText}
				textContainerRef={textContainerRef}
				textRef={textRef}
				taskImages={taskImages}
				goals={goals}
				isEditingGoals={isEditingGoals}
				editableGoals={editableGoals}
				handleAddGoal={handleAddGoal}
				handleRemoveGoal={handleRemoveGoal}
				handleUpdateGoal={handleUpdateGoal}
				handleReorderGoals={handleReorderGoals}
				setIsEditingGoals={setIsEditingGoals}
				currentTaskItem={currentTaskItem}
				buttonsDisabled={buttonsDisabled}
				contextWindow={contextWindow}
				contextTokens={contextTokens || 0}
				maxTokens={maxTokens}
				condenseButton={condenseButton}
				tokensIn={tokensIn}
				tokensOut={tokensOut}
				cacheReads={cacheReads}
				cacheWrites={cacheWrites}
				totalCost={totalCost}
				hasSubtasks={hasSubtasks}
				aggregatedCost={aggregatedCost}
				costBreakdown={costBreakdown}
			/>
			{hasTodos && todos && (
				<TodoListDisplay todos={todos} onTodoClick={(taskId) => pushWindow("chat", { targetNodeId: taskId })} />
			)}
			<ActiveSubagentsList
				nodes={nodes}
				currentTaskItemId={currentTaskItemId}
				onNavigate={(id) => pushWindow("chat", { targetNodeId: id })}
			/>
		</div>
		<CloudUpsellDialog open={isOpen} onOpenChange={closeUpsell} onConnect={handleConnect} />
	</div>
)
