import React, { useCallback, useEffect, useRef, useState } from "react"
import { useDrag, useDrop } from "react-dnd"
import { GripVertical, Pencil, Trash2 } from "lucide-react"
import { cn } from "@src/lib/utils"
import type { DraggableGoalProps } from "../types"

export const DraggableGoal: React.FC<DraggableGoalProps> = ({ goal, index, moveGoal, removeGoal, updateGoal }) => {
	const ref = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLTextAreaElement>(null)
	const [isEditing, setIsEditing] = useState(false)
	const [editText, setEditText] = useState(goal.text)

	const [{ isDragging }, drag] = useDrag({
		type: "GOAL",
		item: () => ({ index }),
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})

	const [, drop] = useDrop({
		accept: "GOAL",
		hover: (draggedItem: { index: number }) => {
			if (draggedItem.index !== index) {
				moveGoal(draggedItem.index, index)
				draggedItem.index = index
			}
		},
	})

	drag(drop(ref))

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus()
			inputRef.current.select()
		}
	}, [isEditing])

	const handleStartEdit = useCallback(() => {
		setEditText(goal.text)
		setIsEditing(true)
	}, [goal.text])

	const handleSaveEdit = useCallback(() => {
		const trimmed = editText.trim()
		if (trimmed && trimmed !== goal.text) {
			updateGoal?.(goal.id, { text: trimmed })
		}
		setIsEditing(false)
	}, [editText, goal.id, goal.text, updateGoal])

	const handleCancelEdit = useCallback(() => {
		setEditText(goal.text)
		setIsEditing(false)
	}, [goal.text])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault()
				handleSaveEdit()
			} else if (e.key === "Escape") {
				e.preventDefault()
				handleCancelEdit()
			}
		},
		[handleSaveEdit, handleCancelEdit],
	)

	return (
		<div
			ref={ref}
			className={cn(
				"flex items-center gap-1.5 px-2 py-1.5 rounded bg-vscode-input-background group",
				isDragging && "opacity-50",
			)}
			style={{ cursor: isEditing ? "default" : "grab" }}>
			<GripVertical className="w-3 h-3 shrink-0 text-vscode-foreground opacity-40" />
			{isEditing ? (
				<textarea
					ref={inputRef}
					value={editText}
					onChange={(e) => setEditText(e.target.value)}
					onBlur={handleSaveEdit}
					onKeyDown={handleKeyDown}
					rows={2}
					className="flex-1 px-1 py-0 text-xs bg-transparent text-vscode-input-foreground outline-none border-b border-vscode-focusBorder resize-none"
				/>
			) : (
				<span
					className="text-xs text-vscode-input-foreground truncate flex-1 cursor-text"
					onDoubleClick={handleStartEdit}
					role="button"
					tabIndex={0}
					aria-label="Edit goal"
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							handleStartEdit()
						}
					}}>
					{goal.text}
				</span>
			)}
			{!isEditing && (
				<>
					<button
						onClick={handleStartEdit}
						className="opacity-0 group-hover:opacity-100 transition-opacity text-vscode-foreground hover:text-vscode-focusBorder"
						aria-label="Edit goal">
						<Pencil className="w-3 h-3" />
					</button>
					<button
						onClick={() => removeGoal(goal.id)}
						className="opacity-0 group-hover:opacity-100 transition-opacity text-vscode-foreground hover:text-vscode-errorForeground"
						aria-label="Remove goal">
						<Trash2 className="w-3 h-3" />
					</button>
				</>
			)}
		</div>
	)
}
