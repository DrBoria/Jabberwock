"use client"

import { Rocket } from "lucide-react"

import { Button } from "@/components/ui"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui"
import { Run as Row } from "@/components/home/run"

import { ConfirmDeleteDialog } from "@/components/home/runs/components/confirm-dialogs"
import { FilterBar } from "@/components/home/runs/components/filter-bar"
import { RunsTableHeader } from "@/components/home/runs/components/runs-table-header"
import { ToolGroupEditorDialog } from "@/components/home/runs/components/tool-group-editor-dialog"
import { useRunsState } from "@/components/home/runs/state/use-runs-state"
import type { RunWithTaskMetrics } from "@/components/home/runs/state/types"

export function Runs({ runs }: { runs: RunWithTaskMetrics[] }) {
	const {
		sortColumn,
		sortDirection,
		timeframeFilter,
		setTimeframeFilter,
		modelFilter,
		setModelFilter,
		providerFilter,
		setProviderFilter,
		toolGroups,
		showGroupDialog,
		setShowGroupDialog,
		editingGroup,
		showDeleteConfirm,
		setShowDeleteConfirm,
		showDeleteOldConfirm,
		setShowDeleteOldConfirm,
		isDeleting,
		modelOptions,
		providerOptions,
		filteredRuns,
		sortedRuns,
		toolColumns,
		totalColumns,
		hasActiveFilters,
		incompleteRunsCount,
		oldRunsCount,
		availableToolsForEditor,
		handleSort,
		clearAllFilters,
		handleDeleteIncompleteRuns,
		handleDeleteOldRuns,
		openNewGroupDialog,
		openEditGroupDialog,
		handleSaveGroup,
		handleDeleteGroup,
		router,
	} = useRunsState(runs)

	return (
		<>
			<FilterBar
				timeframeFilter={timeframeFilter}
				onTimeframeChange={setTimeframeFilter}
				modelFilter={modelFilter}
				modelOptions={modelOptions}
				onModelFilterChange={setModelFilter}
				providerFilter={providerFilter}
				providerOptions={providerOptions}
				onProviderFilterChange={setProviderFilter}
				toolGroups={toolGroups}
				onEditGroup={openEditGroupDialog}
				onDeleteGroup={handleDeleteGroup}
				onNewGroup={openNewGroupDialog}
				hasActiveFilters={hasActiveFilters}
				onClearFilters={clearAllFilters}
				incompleteRunsCount={incompleteRunsCount}
				oldRunsCount={oldRunsCount}
				isDeleting={isDeleting}
				onDeleteIncomplete={() => setShowDeleteConfirm(true)}
				onDeleteOld={() => setShowDeleteOldConfirm(true)}
				filteredRunsCount={filteredRuns.length}
				totalRunsCount={runs.length}
			/>

			<Table className="border border-t-0 rounded-t-none">
				<RunsTableHeader
					sortColumn={sortColumn}
					sortDirection={sortDirection}
					onSort={handleSort}
					toolGroups={toolGroups}
					toolColumns={toolColumns}
				/>
				<TableBody>
					{sortedRuns.length ? (
						sortedRuns.map(({ taskMetrics, ...run }) => (
							<Row
								key={run.id}
								run={run}
								taskMetrics={taskMetrics}
								toolColumns={toolColumns}
								toolGroups={toolGroups}
							/>
						))
					) : (
						<TableRow>
							<TableCell colSpan={totalColumns} className="text-center py-8">
								{runs.length === 0 ? (
									<>
										No eval runs yet.
										<Button variant="link" onClick={() => router.push("/runs/new")}>
											Launch
										</Button>
										one now.
									</>
								) : (
									<>
										No runs match the current filters.
										<Button variant="link" onClick={clearAllFilters}>
											Clear filters
										</Button>
										to see all runs.
									</>
								)}
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>

			<Button
				variant="default"
				className="absolute top-4 right-12 size-12 rounded-full"
				onClick={() => router.push("/runs/new")}>
				<Rocket className="size-6" />
			</Button>

			<ToolGroupEditorDialog
				open={showGroupDialog}
				onOpenChange={setShowGroupDialog}
				editingGroup={editingGroup}
				availableTools={availableToolsForEditor}
				onSave={handleSaveGroup}
			/>

			<ConfirmDeleteDialog
				open={showDeleteConfirm}
				onOpenChange={setShowDeleteConfirm}
				title="Delete Incomplete Runs"
				description={`Are you sure you want to delete ${incompleteRunsCount} incomplete run${incompleteRunsCount !== 1 ? "s" : ""}? This will permanently remove all database records and storage folders for these runs. This action cannot be undone.`}
				count={incompleteRunsCount}
				isDeleting={isDeleting}
				onConfirm={handleDeleteIncompleteRuns}
			/>

			<ConfirmDeleteDialog
				open={showDeleteOldConfirm}
				onOpenChange={setShowDeleteOldConfirm}
				title="Delete Old Runs"
				description={`Are you sure you want to delete ${oldRunsCount} run${oldRunsCount !== 1 ? "s" : ""} older than 30 days? This will permanently remove all database records and storage folders for these runs. This action cannot be undone.`}
				count={oldRunsCount}
				isDeleting={isDeleting}
				onConfirm={handleDeleteOldRuns}
			/>
		</>
	)
}
