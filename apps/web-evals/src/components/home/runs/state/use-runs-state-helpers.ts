"use client"

import { useCallback } from "react"
import { toast } from "sonner"

import type { ToolName } from "@jabberwock/types"

import { deleteIncompleteRuns, deleteOldRuns } from "@/actions/runs"
import { filterRunByModel, filterRunByProvider, filterRunByTimeframe, compareSortValues, getSortValue } from "./helpers"
import type { RunWithTaskMetrics, SortColumn, SortDirection, TimeframeOption, ToolGroup } from "./types"

export function useDeleteHandlers(
	router: { refresh: () => void },
	setIsDeleting: (value: boolean) => void,
	setShowDeleteConfirm: (value: boolean) => void,
	setShowDeleteOldConfirm: (value: boolean) => void,
) {
	const handleDeleteIncompleteRuns = useCallback(async () => {
		setIsDeleting(true)
		try {
			const result = await deleteIncompleteRuns()
			if (result.success) {
				toast.success(`Deleted ${result.deletedCount} incomplete run${result.deletedCount !== 1 ? "s" : ""}`)
				if (result.storageErrors.length > 0)
					toast.warning(`Some storage folders could not be deleted: ${result.storageErrors.length} errors`)
				router.refresh()
			} else toast.error("Failed to delete incomplete runs")
		} catch (error) {
			console.error("Error deleting incomplete runs:", error)
			toast.error("Failed to delete incomplete runs")
		} finally {
			setIsDeleting(false)
			setShowDeleteConfirm(false)
		}
	}, [router, setIsDeleting, setShowDeleteConfirm])

	const handleDeleteOldRuns = useCallback(async () => {
		setIsDeleting(true)
		try {
			const result = await deleteOldRuns()
			if (result.success) {
				toast.success(
					`Deleted ${result.deletedCount} run${result.deletedCount !== 1 ? "s" : ""} older than 30 days`,
				)
				if (result.storageErrors.length > 0)
					toast.warning(`Some storage folders could not be deleted: ${result.storageErrors.length} errors`)
				router.refresh()
			} else toast.error("Failed to delete old runs")
		} catch (error) {
			console.error("Error deleting old runs:", error)
			toast.error("Failed to delete old runs")
		} finally {
			setIsDeleting(false)
			setShowDeleteOldConfirm(false)
		}
	}, [router, setIsDeleting, setShowDeleteOldConfirm])

	return { handleDeleteIncompleteRuns, handleDeleteOldRuns }
}

export function useGroupHandlers(
	editingGroup: ToolGroup | null,
	setToolGroups: (updater: (prev: ToolGroup[]) => ToolGroup[]) => void,
) {
	const handleSaveGroup = useCallback(
		(group: ToolGroup) => {
			setToolGroups((prev) => {
				const idx = prev.findIndex((g) => g.id === group.id)
				if (idx >= 0) {
					const next = [...prev]
					next[idx] = group
					return next
				}
				return [...prev, group]
			})
			toast.success(editingGroup ? "Group updated" : "Group created")
		},
		[editingGroup, setToolGroups],
	)

	const handleDeleteGroup = useCallback(
		(groupId: string) => {
			setToolGroups((prev) => prev.filter((g) => g.id !== groupId))
			toast.success("Group deleted")
		},
		[setToolGroups],
	)

	return { handleSaveGroup, handleDeleteGroup }
}

export function useSortHandler(
	sortColumn: SortColumn | null,
	sortDirection: SortDirection,
	setSortColumn: (column: SortColumn | null) => void,
	setSortDirection: (direction: SortDirection) => void,
) {
	const handleSort = useCallback(
		(column: SortColumn) => {
			if (sortColumn === column) setSortDirection(sortDirection === "asc" ? "desc" : "asc")
			else {
				setSortColumn(column)
				setSortDirection("desc")
			}
		},
		[sortColumn, sortDirection, setSortColumn, setSortDirection],
	)

	return { handleSort }
}

export function computeModelOptions(runs: RunWithTaskMetrics[]) {
	const models = new Set<string>()
	for (const run of runs) if (run.model) models.add(run.model)
	return Array.from(models)
		.sort()
		.map((m) => ({ label: m, value: m }))
}

export function computeProviderOptions(runs: RunWithTaskMetrics[]) {
	const providers = new Set<string>()
	for (const run of runs) {
		const p = run.settings?.apiProvider
		if (p) providers.add(p)
	}
	return Array.from(providers)
		.sort()
		.map((p) => ({ label: p, value: p }))
}

export function filterRuns(
	runs: RunWithTaskMetrics[],
	timeframeFilter: TimeframeOption,
	modelFilter: string[],
	providerFilter: string[],
) {
	return runs.filter((run) => {
		if (!filterRunByTimeframe(run, timeframeFilter)) return false
		if (!filterRunByModel(run, modelFilter)) return false
		if (!filterRunByProvider(run, providerFilter)) return false
		return true
	})
}

export function computeAllToolColumns(filteredRuns: RunWithTaskMetrics[]) {
	const toolTotals = new Map<string, number>()
	for (const run of filteredRuns) {
		if (run.taskMetrics?.toolUsage) {
			for (const [toolName, usage] of Object.entries(run.taskMetrics.toolUsage)) {
				toolTotals.set(toolName, (toolTotals.get(toolName) ?? 0) + usage.attempts)
			}
		}
	}
	return Array.from(toolTotals.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([n]) => n as ToolName)
}

export function computeSortedRuns(
	filteredRuns: RunWithTaskMetrics[],
	sortColumn: SortColumn | null,
	sortDirection: SortDirection,
) {
	if (!sortColumn) return filteredRuns
	return [...filteredRuns].sort((a, b) =>
		compareSortValues(getSortValue(a, sortColumn), getSortValue(b, sortColumn), sortDirection),
	)
}

export function computeAvailableTools(
	toolColumnOptions: { label: string; value: string }[],
	toolGroups: ToolGroup[],
	editingGroup: ToolGroup | null,
) {
	const usedInOtherGroups = new Set<string>()
	for (const group of toolGroups) {
		if (editingGroup && group.id === editingGroup.id) continue
		for (const tool of group.tools) usedInOtherGroups.add(tool)
	}
	return toolColumnOptions.filter((opt) => !usedInOtherGroups.has(opt.value))
}
