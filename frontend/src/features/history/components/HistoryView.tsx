import React, { memo, useState, useMemo, useCallback } from "react"
import { ArrowLeft } from "lucide-react"
import { DeleteTaskDialog } from "./dialogs/DeleteTaskDialog"
import { BatchDeleteTaskDialog } from "./dialogs/BatchDeleteTaskDialog"
import { Button } from "@src/shared/ui/buttons/button"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Tab, TabContent, TabHeader } from "@src/features/foundation/components/ui/layout/Tab"
import { useTaskSearch } from "./hooks/useTaskSearch"
import { useGroupedTasks } from "./hooks/useGroupedTasks"
import { countAllSubtasks } from "./types"
import { SelectionModeButton, SelectionModeHeader } from "./list-view/history-view-components"
import { WorkspaceSelect, SortSelect, SearchField, handleSearchInput } from "./list-view/history-view-filters"
import { TaskList, BatchDeleteFooter } from "./list-view/history-view-utils"

type HistoryViewProps = { onDone: () => void }

const HistoryView = ({ onDone }: HistoryViewProps) => {
	const {
		tasks,
		searchQuery,
		setSearchQuery,
		sortOption,
		setSortOption,
		setLastNonRelevantSort,
		showAllWorkspaces,
		setShowAllWorkspaces,
	} = useTaskSearch()
	const { t } = useAppTranslation()
	const { groups, flatTasks, toggleExpand, isSearchMode } = useGroupedTasks(tasks, searchQuery)

	const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
	const [deleteSubtaskCount, setDeleteSubtaskCount] = useState<number>(0)
	const [isSelectionMode, setIsSelectionMode] = useState(false)
	const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
	const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState<boolean>(false)

	const getSubtaskCount = useMemo(() => {
		const countMap = new Map<string, number>()
		for (const group of groups) countMap.set(group.parent.id, countAllSubtasks(group.subtasks))
		return (taskId: string) => countMap.get(taskId) || 0
	}, [groups])

	const handleDelete = useCallback(
		(taskId: string) => {
			setDeleteTaskId(taskId)
			setDeleteSubtaskCount(getSubtaskCount(taskId))
		},
		[getSubtaskCount],
	)

	const toggleSelectionMode = () => {
		setIsSelectionMode(!isSelectionMode)
		if (isSelectionMode) setSelectedTaskIds([])
	}

	const toggleTaskSelection = useCallback((taskId: string, isSelected: boolean) => {
		if (isSelected) setSelectedTaskIds((prev) => [...prev, taskId])
		else setSelectedTaskIds((prev) => prev.filter((id) => id !== taskId))
	}, [])

	const toggleSelectAll = (selectAll: boolean) => setSelectedTaskIds(selectAll ? tasks.map((task) => task.id) : [])
	const handleBatchDelete = () => {
		if (selectedTaskIds.length > 0) setShowBatchDeleteDialog(true)
	}

	const isSelectionActive = isSelectionMode && selectedTaskIds.length > 0

	return (
		<Tab data-testid="history-view">
			<TabHeader className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							className="px-1.5 -ml-2"
							onClick={onDone}
							aria-label={t("history:done")}
							data-testid="history-done-button">
							<ArrowLeft />
							<span className="sr-only">{t("history:done")}</span>
						</Button>
						<h3 className="text-vscode-foreground m-0">{t("history:history")}</h3>
					</div>
					<SelectionModeButton isSelectionMode={isSelectionMode} onToggle={toggleSelectionMode} />
				</div>
				<div className="flex flex-col gap-2">
					<SearchField
						searchQuery={searchQuery}
						onInput={(e) =>
							handleSearchInput(
								e,
								searchQuery,
								sortOption,
								setSearchQuery,
								setLastNonRelevantSort,
								setSortOption,
							)
						}
						onClear={() => setSearchQuery("")}
					/>
					<div className="flex gap-2">
						<WorkspaceSelect showAllWorkspaces={showAllWorkspaces} onChange={setShowAllWorkspaces} />
						<SortSelect sortOption={sortOption} searchQuery={searchQuery} onChange={setSortOption} />
					</div>
					<SelectionModeHeader
						isSelectionMode={isSelectionMode}
						tasks={tasks}
						selectedTaskIds={selectedTaskIds}
						onToggleSelectAll={toggleSelectAll}
					/>
				</div>
			</TabHeader>
			<TabContent className="px-2 py-0">
				{isSearchMode && flatTasks ? (
					<TaskList
						items={flatTasks}
						variant="search"
						showWorkspace={showAllWorkspaces}
						isSelectionMode={isSelectionMode}
						selectedTaskIds={selectedTaskIds}
						onToggleSelection={toggleTaskSelection}
						onDelete={handleDelete}
					/>
				) : (
					<TaskList
						items={groups}
						variant="group"
						showWorkspace={showAllWorkspaces}
						isSelectionMode={isSelectionMode}
						selectedTaskIds={selectedTaskIds}
						onToggleSelection={toggleTaskSelection}
						onDelete={handleDelete}
						onToggleExpand={toggleExpand}
					/>
				)}
			</TabContent>
			<BatchDeleteFooter
				isSelectionActive={isSelectionActive}
				selectedCount={selectedTaskIds.length}
				totalCount={tasks.length}
				onClearSelection={() => setSelectedTaskIds([])}
				onBatchDelete={handleBatchDelete}
			/>
			{deleteTaskId && (
				<DeleteTaskDialog
					taskId={deleteTaskId}
					subtaskCount={deleteSubtaskCount}
					onOpenChange={(open) => {
						if (!open) {
							setDeleteTaskId(null)
							setDeleteSubtaskCount(0)
						}
					}}
					open
				/>
			)}
			{showBatchDeleteDialog && (
				<BatchDeleteTaskDialog
					taskIds={selectedTaskIds}
					open={showBatchDeleteDialog}
					onOpenChange={(open) => {
						if (!open) {
							setShowBatchDeleteDialog(false)
							setSelectedTaskIds([])
							setIsSelectionMode(false)
						}
					}}
				/>
			)}
		</Tab>
	)
}

export default memo(HistoryView)
