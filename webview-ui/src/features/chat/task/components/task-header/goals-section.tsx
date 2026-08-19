import type { Goal } from "@jabberwock/types"
import { SquarePen } from "lucide-react"
import { DndTextArea } from "@sections/dndTextArea/view"

interface GoalsSectionProps {
	goals: Goal[]
	isEditingGoals: boolean
	editableGoals: Goal[]
	onAddGoal: (text: string) => void
	onRemoveGoal: (id: string) => void
	onUpdateGoal: (id: string, partial: Partial<Goal>) => void
	onReorderGoals: (fromIndex: number, toIndex: number) => void
	onCancelEdit: () => void
	onStartEdit: () => void
}

export const GoalsSection = ({
	goals,
	isEditingGoals,
	editableGoals,
	onAddGoal,
	onRemoveGoal,
	onUpdateGoal,
	onReorderGoals,
	onCancelEdit,
	onStartEdit,
}: GoalsSectionProps) => {
	if (isEditingGoals) {
		return (
			<DndTextArea
				placeholderText=""
				onSend={onCancelEdit}
				onSelectImages={() => {}}
				shouldDisableImages={true}
				modeShortcutText=""
				isEditMode={true}
				goals={editableGoals}
				onAddGoal={onAddGoal}
				onRemoveGoal={onRemoveGoal}
				onUpdateGoal={onUpdateGoal}
				onReorderGoals={onReorderGoals}
				onCancel={onCancelEdit}
			/>
		)
	}
	return (
		<div className="flex items-center gap-2">
			<span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Goals</span>
			<div className="flex flex-wrap gap-1.5 flex-1">
				{goals.map((goal, index) => (
					<span
						key={goal.id}
						className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-vscode-input-background border border-vscode-sideBar-border">
						<span className="font-medium text-vscode-textLink-foreground">@{index + 1}</span>
						<span>{goal.text}</span>
					</span>
				))}
			</div>
			<button
				onClick={onStartEdit}
				className="shrink-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-vscode-toolbar-hoverBackground"
				aria-label="Edit goals"
				title="Edit goals">
				<SquarePen className="w-3.5 h-3.5" />
			</button>
		</div>
	)
}
