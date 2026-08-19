import { memo } from "react"
import { ArrowRight, Folder } from "lucide-react"
import type { DisplayHistoryItem } from "../types"

import { rootStore } from "@src/features/store"
import { cn } from "@/lib/utils"
import { Checkbox } from "@src/shared/ui/inputs/checkbox"

import TaskItemFooter from "./TaskItemFooter"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"

interface TaskItemProps {
	item: DisplayHistoryItem
	variant: "compact" | "full"
	showWorkspace?: boolean
	hasSubtasks?: boolean
	isSelectionMode?: boolean
	isSelected?: boolean
	onToggleSelection?: (taskId: string, isSelected: boolean) => void
	onDelete?: (taskId: string) => void
	className?: string
}

interface TaskContentDisplayProps {
	item: DisplayHistoryItem
	isCompact: boolean
	isSelectionMode: boolean | undefined
}

const TaskContentDisplay: React.FC<TaskContentDisplayProps> = ({ item, isCompact, isSelectionMode }) => {
	const contentClass = cn(
		"flex-1 min-w-0 overflow-hidden whitespace-pre-wrap font-light text-ellipsis line-clamp-3",
		{
			"text-base": !isCompact,
		},
		!isCompact && isSelectionMode ? "mb-1" : "",
	)

	if (item.highlight) {
		return (
			<div
				className={contentClass}
				data-testid="task-content"
				dangerouslySetInnerHTML={{ __html: item.highlight }}
			/>
		)
	}

	return (
		<div className={contentClass} data-testid="task-content">
			<StandardTooltip content={item.task}>
				<span>{item.task}</span>
			</StandardTooltip>
		</div>
	)
}

const TaskItem = (props: TaskItemProps) => {
	const {
		item,
		variant,
		showWorkspace,
		hasSubtasks,
		isSelectionMode,
		isSelected,
		onToggleSelection,
		onDelete,
		className,
	} = props

	const handleClick = () => {
		if (isSelectionMode && onToggleSelection) {
			onToggleSelection(item.id, !isSelected)
		} else {
			rootStore.chat.navigateToTask(item.id)
		}
	}

	const isCompact = variant === "compact"

	const rowClass = cn(
		"cursor-pointer group relative overflow-hidden",
		"text-vscode-foreground/80 hover:text-vscode-foreground transition-colors",
		hasSubtasks ? "rounded-t-xl" : "rounded-xl",
		className,
	)

	const contentWrapperClass = (!isCompact && isSelectionMode ? "pl-3 pb-3" : "pl-4") + " flex gap-3 px-3 pt-3 pb-1"

	return (
		<div key={item.id} data-testid={`task-item-${item.id}`} className={rowClass} onClick={handleClick}>
			<div className={contentWrapperClass}>
				{!isCompact && isSelectionMode && (
					<div
						className="task-checkbox mt-1"
						onClick={(e) => {
							e.stopPropagation()
						}}>
						<Checkbox
							checked={isSelected}
							onCheckedChange={(checked: boolean) => onToggleSelection?.(item.id, checked === true)}
							variant="description"
						/>
					</div>
				)}

				<div className="flex-1 min-w-0">
					<div className="flex items-start gap-1">
						<TaskContentDisplay item={item} isCompact={isCompact} isSelectionMode={isSelectionMode} />
						<ArrowRight className="size-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
					</div>

					{showWorkspace && item.workspace && (
						<div className="flex items-center font-mono gap-1 text-vscode-descriptionForeground text-xs mt-1">
							<Folder className="size-3" />
							<span>{item.workspace}</span>
						</div>
					)}

					<TaskItemFooter
						item={item}
						variant={variant}
						isSelectionMode={isSelectionMode}
						isSubtask={item.isSubtask}
						onDelete={onDelete}
					/>
				</div>
			</div>
		</div>
	)
}

export default memo(TaskItem)
