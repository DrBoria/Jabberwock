import { Virtuoso } from "react-virtuoso"
import { Button } from "@src/shared/ui/buttons/button"
import { useAppTranslation } from "@/i18n/TranslationContext"
import type { DisplayHistoryItem, TaskGroup } from "../types"
import TaskItem from "../task-rows/TaskItem"
import TaskGroupItem from "../task-rows/TaskGroupItem"
import { VirtuosoList } from "./history-view-components"

export const TaskList = ({
	items,
	variant,
	showWorkspace,
	isSelectionMode,
	selectedTaskIds,
	onToggleSelection,
	onDelete,
	onToggleExpand,
}: {
	items: DisplayHistoryItem[] | TaskGroup[]
	variant: "search" | "group"
	showWorkspace: boolean
	isSelectionMode: boolean
	selectedTaskIds: string[]
	onToggleSelection: (taskId: string, isSelected: boolean) => void
	onDelete: (taskId: string) => void
	onToggleExpand?: (id: string) => void
}) => {
	if (variant === "search") {
		return (
			<Virtuoso
				className="flex-1 overflow-y-scroll"
				data={items as DisplayHistoryItem[]}
				data-testid="virtuoso-container"
				initialTopMostItemIndex={0}
				components={{ List: VirtuosoList }}
				itemContent={(_index: number, item: DisplayHistoryItem) => (
					<TaskItem
						key={item.id}
						item={item}
						variant="full"
						showWorkspace={showWorkspace}
						isSelectionMode={isSelectionMode}
						isSelected={selectedTaskIds.includes(item.id)}
						onToggleSelection={onToggleSelection}
						onDelete={onDelete}
						className="m-2"
					/>
				)}
			/>
		)
	}
	return (
		<Virtuoso
			className="flex-1 overflow-y-scroll"
			data={items as TaskGroup[]}
			data-testid="virtuoso-container"
			initialTopMostItemIndex={0}
			components={{ List: VirtuosoList }}
			itemContent={(_index: number, group: TaskGroup) => (
				<TaskGroupItem
					key={group.parent.id}
					group={group}
					variant="full"
					showWorkspace={showWorkspace}
					isSelectionMode={isSelectionMode}
					isSelected={selectedTaskIds.includes(group.parent.id)}
					onToggleSelection={onToggleSelection}
					onDelete={onDelete}
					onToggleExpand={() => onToggleExpand?.(group.parent.id)}
					onToggleSubtaskExpand={onToggleExpand ?? (() => {})}
					className="m-2"
				/>
			)}
		/>
	)
}

export const BatchDeleteFooter = ({
	isSelectionActive,
	selectedCount,
	totalCount,
	onClearSelection,
	onBatchDelete,
}: {
	isSelectionActive: boolean
	selectedCount: number
	totalCount: number
	onClearSelection: () => void
	onBatchDelete: () => void
}) => {
	const { t } = useAppTranslation()
	if (!isSelectionActive) return null
	return (
		<div className="fixed bottom-0 left-0 right-2 bg-vscode-editor-background border-t border-vscode-panel-border p-2 flex justify-between items-center">
			<div className="text-vscode-foreground">
				{t("history:selectedItems", { selected: selectedCount, total: totalCount })}
			</div>
			<div className="flex gap-2">
				<Button variant="secondary" onClick={onClearSelection}>
					{t("history:clearSelection")}
				</Button>
				<Button variant="primary" onClick={onBatchDelete}>
					{t("history:deleteSelected")}
				</Button>
			</div>
		</div>
	)
}
