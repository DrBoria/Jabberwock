import React from "react"
import { Plus } from "lucide-react"
import { Button } from "@src/shared/ui/buttons/button-primitive"
import { ADD_GOAL_PLACEHOLDER } from "../constants"
import type { EditModeGoalInputProps } from "../types"
import { useCommitGoal } from "../hooks/use-commit-goal"

export const EditModeGoalInput: React.FC<EditModeGoalInputProps> = ({ textAreaStore, onAddGoal }) => {
	const commitGoal = useCommitGoal(textAreaStore, onAddGoal)

	return (
		<div className="flex items-center gap-1.5 mb-2">
			<input
				type="text"
				value={textAreaStore.inputValue}
				onChange={(e) => textAreaStore.setInputValue(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.nativeEvent?.isComposing) {
						e.preventDefault()
						commitGoal()
					}
				}}
				placeholder={ADD_GOAL_PLACEHOLDER}
				className="flex-1 px-2 py-1 text-sm bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded outline-none focus:border-vscode-focusBorder"
			/>
			<Button
				variant="iconButtonMuted"
				size="icon"
				aria-label="Add goal"
				disabled={!textAreaStore.inputValue.trim()}
				onClick={commitGoal}>
				<Plus className="w-4 h-4" />
			</Button>
		</div>
	)
}
