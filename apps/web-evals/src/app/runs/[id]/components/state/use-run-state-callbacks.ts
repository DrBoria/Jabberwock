"use client"

import { useCallback, useEffect } from "react"
import { toast } from "sonner"

import { killRun } from "@/actions/runs"
import type { Task } from "@jabberwock/evals"
import type { TokenUsage } from "@jabberwock/types"
import type { TaskMetrics } from "../run-helpers"

export function useRunStateCallbacks(
	runId: number,
	taskLog: string | null,
	selectedTask: Task | null,
	tokenUsage: Map<number, TokenUsage & { duration?: number }>,
	taskMetricsCache: Record<number, TaskMetrics>,
	setSelectedTask: (task: Task | null) => void,
	setTaskLog: (log: string | null) => void,
	setIsLoadingLog: (loading: boolean) => void,
	setCopied: (copied: boolean) => void,
	setIsKilling: (killing: boolean) => void,
	setShowKillDialog: (show: boolean) => void,
) {
	const onKillRun = useCallback(async () => {
		setIsKilling(true)
		try {
			const result = await killRun(runId)
			if (result.killedContainers.length > 0) {
				toast.success(`Killed ${result.killedContainers.length} container(s)`)
			} else if (result.errors.length === 0) {
				toast.info("No running containers found")
			} else {
				toast.error(result.errors.join(", "))
			}
		} catch (error) {
			console.error("Failed to kill run:", error)
			toast.error("Failed to kill run")
		} finally {
			setIsKilling(false)
			setShowKillDialog(false)
		}
	}, [runId, setIsKilling, setShowKillDialog])

	const onCopyLog = useCallback(async () => {
		if (!taskLog) return
		try {
			await navigator.clipboard.writeText(taskLog)
			setCopied(true)
			toast.success("Log copied to clipboard")
			setTimeout(() => setCopied(false), 2000)
		} catch (error) {
			console.error("Failed to copy log:", error)
			toast.error("Failed to copy log")
		}
	}, [taskLog, setCopied])

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && selectedTask) {
				setSelectedTask(null)
			}
		}
		document.addEventListener("keydown", handleKeyDown)
		return () => document.removeEventListener("keydown", handleKeyDown)
	}, [selectedTask, setSelectedTask])

	const onViewTaskLog = useCallback(
		async (task: Task) => {
			const hasStarted = !!task.startedAt || !!tokenUsage.get(task.id) || !!taskMetricsCache[task.id]
			if (!hasStarted) {
				toast.error("Task has not started yet")
				return
			}
			setSelectedTask(task)
			setIsLoadingLog(true)
			setTaskLog(null)
			try {
				const response = await fetch(`/api/runs/${runId}/logs/${task.id}`)
				if (!response.ok) {
					const error = await response.json()
					toast.error(error.error || "Failed to load log")
					setSelectedTask(null)
					return
				}
				const data = await response.json()
				setTaskLog(data.logContent)
			} catch (error) {
				console.error("Error loading task log:", error)
				toast.error("Failed to load log")
				setSelectedTask(null)
			} finally {
				setIsLoadingLog(false)
			}
		},
		[runId, tokenUsage, taskMetricsCache, setSelectedTask, setTaskLog, setIsLoadingLog],
	)

	return { onKillRun, onCopyLog, onViewTaskLog }
}
