"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import type { Run, Task } from "@jabberwock/evals"
import type { ToolName } from "@jabberwock/types"

import { useRunStatus } from "@/hooks/use-run-status"

import type { TaskMetrics, TaskWithMetrics } from "./components/run-helpers"
import { computeTaskMetrics, computeAggregateToolUsage } from "./compute-run-data"
import { useRunStateCallbacks } from "./components/state/use-run-state-callbacks"
import { STATUS_ORDER, type TaskStatusCategory } from "./components/state/use-run-state.types"

export { type TaskStatusCategory, STATUS_ORDER }

export function useRunState(run: Run) {
	const runStatus = useRunStatus(run)
	const { tasks, tokenUsage, toolUsage, usageUpdatedAt, heartbeat, runners } = runStatus

	const [selectedTask, setSelectedTask] = useState<Task | null>(null)
	const [taskLog, setTaskLog] = useState<string | null>(null)
	const [isLoadingLog, setIsLoadingLog] = useState(false)
	const [copied, setCopied] = useState(false)
	const [showKillDialog, setShowKillDialog] = useState(false)
	const [isKilling, setIsKilling] = useState(false)
	const [groupByStatus, setGroupByStatus] = useState(() => {
		if (typeof window !== "undefined") {
			const stored = localStorage.getItem("evals-group-by-status")
			return stored === "true"
		}
		return false
	})

	useEffect(() => {
		localStorage.setItem("evals-group-by-status", String(groupByStatus))
	}, [groupByStatus])

	const isRunActive = !run.taskMetricsId && (!!heartbeat || (runners && runners.length > 0))

	const taskMetricsCache: Record<number, TaskMetrics> = useMemo(() => {
		void usageUpdatedAt
		return computeTaskMetrics(tasks, tokenUsage)
	}, [tasks, tokenUsage, usageUpdatedAt])

	const { onKillRun, onCopyLog, onViewTaskLog } = useRunStateCallbacks(
		run.id,
		taskLog,
		selectedTask,
		tokenUsage,
		taskMetricsCache,
		setSelectedTask,
		setTaskLog,
		setIsLoadingLog,
		setCopied,
		setIsKilling,
		setShowKillDialog,
	)

	const toolColumns = useMemo<ToolName[]>(() => {
		void usageUpdatedAt
		if (!tasks) return []
		const toolTotals = new Map<ToolName, number>()
		for (const task of tasks) {
			const dbToolUsage = task.taskMetrics?.toolUsage
			const streamingToolUsage = toolUsage.get(task.id)
			const taskToolUsage = task.finishedAt
				? dbToolUsage && Object.keys(dbToolUsage).length > 0
					? dbToolUsage
					: streamingToolUsage
				: streamingToolUsage
			if (taskToolUsage) {
				for (const [toolName, usage] of Object.entries(taskToolUsage)) {
					const tool = toolName as ToolName
					const current = toolTotals.get(tool) ?? 0
					toolTotals.set(tool, current + usage.attempts)
				}
			}
		}
		return Array.from(toolTotals.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([name]): ToolName => name)
	}, [tasks, toolUsage, usageUpdatedAt])

	const stats = useMemo(() => {
		void usageUpdatedAt
		if (!tasks) return null
		const passed = tasks.filter((t) => t.passed === true).length
		const failed = tasks.filter((t) => t.passed === false).length
		const completed = passed + failed
		const {
			totalTokensIn,
			totalTokensOut,
			totalCost,
			totalDuration,
			toolUsage: toolUsageAggregate,
		} = computeAggregateToolUsage(tasks, toolUsage, taskMetricsCache)
		const remaining = tasks.length - completed
		return {
			passed,
			failed,
			completed,
			remaining,
			passRate: completed > 0 ? ((passed / completed) * 100).toFixed(1) : null,
			totalTokensIn,
			totalTokensOut,
			totalCost,
			totalDuration,
			toolUsage: toolUsageAggregate,
		}
	}, [tasks, taskMetricsCache, toolUsage, usageUpdatedAt])

	const elapsedTime = useMemo(() => {
		void usageUpdatedAt
		if (!tasks || tasks.length === 0) return null
		const startTime = new Date(run.createdAt).getTime()
		if (run.taskMetricsId) {
			const latestFinish = tasks.reduce((latest, task) => {
				if (task.finishedAt) {
					const finishTime = new Date(task.finishedAt).getTime()
					return finishTime > latest ? finishTime : latest
				}
				return latest
			}, startTime)
			return latestFinish - startTime
		}
		return Date.now() - startTime
	}, [tasks, run.createdAt, run.taskMetricsId, usageUpdatedAt])

	const getTaskStatusCategory = useCallback(
		(task: TaskWithMetrics): TaskStatusCategory => {
			if (task.passed === false) return "failed"
			if (task.passed === true) return "passed"
			const hasStarted = !!task.startedAt || !!tokenUsage.get(task.id) || !!taskMetricsCache[task.id]
			if (hasStarted) return "in_progress"
			return "not_started"
		},
		[tokenUsage, taskMetricsCache],
	)

	const groupedTasks = useMemo(() => {
		if (!tasks || !groupByStatus) return null
		const groups: Record<TaskStatusCategory, Array<{ task: TaskWithMetrics; originalIndex: number }>> = {
			failed: [],
			in_progress: [],
			passed: [],
			not_started: [],
		}
		tasks.forEach((task, index) => {
			const status = getTaskStatusCategory(task)
			groups[status].push({ task, originalIndex: index })
		})
		return groups
	}, [tasks, groupByStatus, getTaskStatusCategory])

	const statusLabels = useMemo(
		(): Record<TaskStatusCategory, { label: string; className: string; count: number }> => ({
			failed: { label: "Failed", className: "text-red-500", count: groupedTasks?.failed.length ?? 0 },
			in_progress: {
				label: "In Progress",
				className: "text-yellow-500",
				count: groupedTasks?.in_progress.length ?? 0,
			},
			passed: { label: "Passed", className: "text-green-500", count: groupedTasks?.passed.length ?? 0 },
			not_started: {
				label: "Not Started",
				className: "text-muted-foreground",
				count: groupedTasks?.not_started.length ?? 0,
			},
		}),
		[groupedTasks],
	)

	return {
		selectedTask,
		setSelectedTask,
		taskLog,
		isLoadingLog,
		copied,
		showKillDialog,
		isKilling,
		groupByStatus,
		setGroupByStatus,
		setShowKillDialog,
		taskMetricsCache,
		toolColumns,
		stats,
		elapsedTime,
		groupedTasks,
		statusLabels,
		statusOrder: STATUS_ORDER,
		isRunActive,
		onKillRun,
		onCopyLog,
		onViewTaskLog,
		runStatus,
		tasks,
		toolUsage,
	}
}
