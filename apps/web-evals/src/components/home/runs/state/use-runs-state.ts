"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { useLocalStorageState, useStringLocalStorageState } from "@/hooks/use-local-storage-state"

import { STORAGE_KEYS } from "./constants"

import type { RunWithTaskMetrics, SortColumn, SortDirection, TimeframeOption, ToolGroup } from "./types"
import {
	useDeleteHandlers,
	useGroupHandlers,
	useSortHandler,
	computeModelOptions,
	computeProviderOptions,
	filterRuns,
	computeAllToolColumns,
	computeSortedRuns,
	computeAvailableTools,
} from "./use-runs-state-helpers"

export function useRunsState(runs: RunWithTaskMetrics[]) {
	const router = useRouter()
	const [sortColumn, setSortColumn] = useState<SortColumn | null>("createdAt")
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

	const [timeframeFilter, setTimeframeFilter] = useStringLocalStorageState(STORAGE_KEYS.TIMEFRAME, "all") as [
		TimeframeOption,
		(v: TimeframeOption) => void,
	]
	const [modelFilter, setModelFilter] = useLocalStorageState<string[]>(STORAGE_KEYS.MODEL_FILTER, [])
	const [providerFilter, setProviderFilter] = useLocalStorageState<string[]>(STORAGE_KEYS.PROVIDER_FILTER, [])
	const [toolGroups, setToolGroups] = useLocalStorageState<ToolGroup[]>(STORAGE_KEYS.TOOL_GROUPS, [])

	const [showGroupDialog, setShowGroupDialog] = useState(false)
	const [editingGroup, setEditingGroup] = useState<ToolGroup | null>(null)
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
	const [showDeleteOldConfirm, setShowDeleteOldConfirm] = useState(false)
	const [isDeleting, setIsDeleting] = useState(false)

	const incompleteRunsCount = useMemo(() => runs.filter((r) => r.taskMetrics === null).length, [runs])

	const oldRunsCount = useMemo(() => {
		const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
		return runs.filter((r) => r.createdAt < thirtyDaysAgo).length
	}, [runs])

	const { handleDeleteIncompleteRuns, handleDeleteOldRuns } = useDeleteHandlers(
		router,
		setIsDeleting,
		setShowDeleteConfirm,
		setShowDeleteOldConfirm,
	)

	const { handleSaveGroup, handleDeleteGroup } = useGroupHandlers(editingGroup, setToolGroups)

	const { handleSort } = useSortHandler(sortColumn, sortDirection, setSortColumn, setSortDirection)

	const modelOptions = useMemo(() => computeModelOptions(runs), [runs])

	const providerOptions = useMemo(() => computeProviderOptions(runs), [runs])

	const filteredRuns = useMemo(
		() => filterRuns(runs, timeframeFilter, modelFilter, providerFilter),
		[runs, timeframeFilter, modelFilter, providerFilter],
	)

	const allToolColumns = useMemo(() => computeAllToolColumns(filteredRuns), [filteredRuns])

	const toolColumnOptions = useMemo(() => allToolColumns.map((t) => ({ label: t, value: t })), [allToolColumns])

	const groupedTools = useMemo(() => {
		const grouped = new Set<string>()
		for (const group of toolGroups) for (const tool of group.tools) grouped.add(tool)
		return grouped
	}, [toolGroups])

	const individualToolColumns = useMemo(
		() => allToolColumns.filter((t) => !groupedTools.has(t)),
		[allToolColumns, groupedTools],
	)
	const toolColumns = individualToolColumns

	const sortedRuns = useMemo(
		() => computeSortedRuns(filteredRuns, sortColumn, sortDirection),
		[filteredRuns, sortColumn, sortDirection],
	)

	const totalColumns = 7 + toolGroups.length + toolColumns.length + 3
	const hasActiveFilters = timeframeFilter !== "all" || modelFilter.length > 0 || providerFilter.length > 0

	const clearAllFilters = () => {
		setTimeframeFilter("all" as TimeframeOption)
		setModelFilter([])
		setProviderFilter([])
	}

	const openNewGroupDialog = useCallback(() => {
		setEditingGroup(null)
		setShowGroupDialog(true)
	}, [])
	const openEditGroupDialog = useCallback((group: ToolGroup) => {
		setEditingGroup(group)
		setShowGroupDialog(true)
	}, [])

	const availableToolsForEditor = useMemo(
		() => computeAvailableTools(toolColumnOptions, toolGroups, editingGroup),
		[toolColumnOptions, toolGroups, editingGroup],
	)

	return {
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
	}
}
