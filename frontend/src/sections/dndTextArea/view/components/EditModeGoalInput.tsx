import React from "react"
import { Plus } from "lucide-react"
import { Button } from "@src/shared/ui/buttons/button"
import { ADD_GOAL_PLACEHOLDER } from "../constants"
import type { EditModeGoalInputProps } from "../types"

export const EditModeGoalInput: React.FC<EditModeGoalInputProps> = ({ textAreaStore, onAddGoal }) => (
	<div className="flex items-center gap-1.5 mb-2">
		<input
			type="text"
			value={textAreaStore.inputValue}
			onChange={(e) => textAreaStore.setInputValue(e.target.value)}
			onKeyDown={(e) => {
				if (e.key === "Enter" && !e.nativeEvent?.isComposing) {
					e.preventDefault()
					if (onAddGoal && textAreaStore.inputValue.trim()) {
						onAddGoal(textAreaStore.inputValue.trim())
						textAreaStore.setInputValue("")
					}
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
			onClick={() => {
				if (onAddGoal && textAreaStore.inputValue.trim()) {
					onAddGoal(textAreaStore.inputValue.trim())
					textAreaStore.setInputValue("")
				}
			}}>
			<Plus className="w-4 h-4" />
		</Button>
	</div>
)
