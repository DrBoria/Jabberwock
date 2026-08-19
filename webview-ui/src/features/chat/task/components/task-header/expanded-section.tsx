import type { Goal, HistoryItem } from "@jabberwock/types"
import Thumbnails from "@src/features/foundation/components/ui/display/Thumbnails"
import { TaskActions } from "../../messages/components/displays/task-actions"
import { Mention } from "@sections/dndTextArea/mention/mention"
import { TaskMetricsTable } from "../task-metrics/rows"
import { GoalsSection } from "./goals-section"

interface ExpandedTaskSectionProps {
	taskText: string
	textContainerRef: React.RefObject<HTMLDivElement>
	textRef: React.RefObject<HTMLDivElement>
	taskImages: string[]
	goals: Goal[]
	isEditingGoals: boolean
	editableGoals: Goal[]
	handleAddGoal: (text: string) => void
	handleRemoveGoal: (id: string) => void
	handleUpdateGoal: (id: string, partial: Partial<Goal>) => void
	handleReorderGoals: (fromIndex: number, toIndex: number) => void
	setIsEditingGoals: (v: boolean) => void
	currentTaskItem: HistoryItem | undefined
	buttonsDisabled: boolean
	contextWindow: number
	contextTokens: number
	maxTokens: number
	condenseButton: React.ReactNode
	tokensIn: number | undefined
	tokensOut: number | undefined
	cacheReads: number | undefined
	cacheWrites: number | undefined
	totalCost: number | undefined
	hasSubtasks: boolean
	aggregatedCost: number | undefined
	costBreakdown: string | undefined
}

export const ExpandedTaskSection = ({
	taskText,
	textContainerRef,
	textRef,
	taskImages,
	goals,
	isEditingGoals,
	editableGoals,
	handleAddGoal,
	handleRemoveGoal,
	handleUpdateGoal,
	handleReorderGoals,
	setIsEditingGoals,
	currentTaskItem,
	buttonsDisabled,
	contextWindow,
	contextTokens,
	maxTokens,
	condenseButton,
	tokensIn,
	tokensOut,
	cacheReads,
	cacheWrites,
	totalCost,
	hasSubtasks,
	aggregatedCost,
	costBreakdown,
}: ExpandedTaskSectionProps) => (
	<>
		<div
			ref={textContainerRef}
			className="text-vscode-font-size overflow-y-auto break-words break-anywhere relative">
			<div
				ref={textRef}
				className="overflow-auto max-h-80 whitespace-pre-wrap break-words break-anywhere cursor-text py-0.5"
				style={{ display: "-webkit-box", WebkitLineClamp: "unset", WebkitBoxOrient: "vertical" }}>
				<Mention text={taskText} />
			</div>
		</div>
		{taskImages.length > 0 && <Thumbnails images={taskImages} />}
		{(goals.length > 0 || isEditingGoals) && (
			<div className="mt-1" onClick={(e) => e.stopPropagation()}>
				<GoalsSection
					goals={goals}
					isEditingGoals={isEditingGoals}
					editableGoals={editableGoals}
					onAddGoal={handleAddGoal}
					onRemoveGoal={handleRemoveGoal}
					onUpdateGoal={handleUpdateGoal}
					onReorderGoals={handleReorderGoals}
					onCancelEdit={() => setIsEditingGoals(false)}
					onStartEdit={() => setIsEditingGoals(true)}
				/>
			</div>
		)}
		<div onClick={(e) => e.stopPropagation()}>
			<TaskActions item={currentTaskItem} buttonsDisabled={buttonsDisabled} />
		</div>
		<div className="pt-3 mt-2 -mx-2.5 px-2.5 border-t border-vscode-sideBar-background">
			<TaskMetricsTable
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
				currentTaskItemSize={currentTaskItem?.size as number | undefined}
			/>
		</div>
	</>
)
