import { useCallback } from "react"

import type { IDynamicTextAreaStore } from "../../store"

/**
 * Shared "commit the current text-area value as a goal" action, used by both
 * `EditModeGoalInput` and `GoalsSection`. Trims the value, adds it via
 * `onAddGoal` (when present and non-empty) and clears the input. Extracted so
 * the two components don't each re-implement the same add-and-clear logic
 * (see `local/no-duplicated-logic`).
 */
export const useCommitGoal = (textAreaStore: IDynamicTextAreaStore, onAddGoal?: (goal: string) => void) =>
	useCallback(() => {
		const value = textAreaStore.inputValue.trim()
		if (onAddGoal && value) {
			onAddGoal(value)
			textAreaStore.setInputValue("")
		}
	}, [textAreaStore, onAddGoal])
