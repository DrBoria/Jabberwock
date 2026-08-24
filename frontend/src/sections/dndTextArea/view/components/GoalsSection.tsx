import React, { Fragment } from "react"
import { Plus } from "lucide-react"
import { DraggableGoal } from "./DraggableGoal"
import type { GoalsSectionProps } from "../types"

export const GoalsSection: React.FC<GoalsSectionProps> = ({
	goals,
	isEditMode,
	onAddGoal,
	hasContent,
	moveGoal,
	onRemoveGoal,
	onUpdateGoal,
	textAreaStore,
	t,
}) => {
	const showArea = goals.length > 0 || (!isEditMode && onAddGoal && hasContent)
	if (!showArea) {
		return null
	}

	return (
		<div className="flex flex-col mb-0.5 max-h-32 overflow-y-auto">
			{goals.map((goal, index) => (
				<Fragment key={goal.id}>
					{index > 0 && <div className="h-px bg-vscode-sideBar-border mx-2" />}
					<DraggableGoal
						goal={goal}
						index={index}
						moveGoal={moveGoal}
						removeGoal={onRemoveGoal || (() => {})}
						updateGoal={onUpdateGoal}
					/>
				</Fragment>
			))}
			{!isEditMode && onAddGoal && hasContent && (
				<div
					className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer text-vscode-descriptionForeground hover:text-vscode-list-activeSelectionForeground rounded transition-colors"
					onClick={() => {
						if (textAreaStore.inputValue.trim()) {
							onAddGoal(textAreaStore.inputValue.trim())
							textAreaStore.setInputValue("")
						}
					}}>
					<Plus className="w-3.5 h-3.5 shrink-0" />
					<span className="text-xs">{t("chat:addGoal")}</span>
				</div>
			)}
		</div>
	)
}
