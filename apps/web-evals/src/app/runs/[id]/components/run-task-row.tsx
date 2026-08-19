"use client"

import { FileText } from "lucide-react"

import type { ToolName } from "@jabberwock/types"
import { formatTokens, formatCurrency, formatDuration, formatToolUsageSuccessRate } from "@/lib/formatters"
import { Tooltip, TooltipContent, TooltipTrigger, TableRow, TableCell } from "@/components/ui"

import { TaskStatus } from "../task-status"
import {
	type TaskWithMetrics,
	type TaskMetrics,
	type ToolUsage,
	resolveTaskToolUsage,
	getSuccessRate,
	getSuccessRateColor,
} from "./run-helpers"

export function RunTaskRow({
	task,
	originalIndex,
	taskMetrics,
	toolColumns,
	toolUsage,
	onViewTaskLog,
}: {
	task: TaskWithMetrics
	originalIndex: number
	taskMetrics: Record<number, TaskMetrics>
	toolColumns: ToolName[]
	toolUsage: Map<number, ToolUsage | undefined>
	onViewTaskLog: (task: TaskWithMetrics) => void
}) {
	const hasStarted = !!task.startedAt || !!toolUsage.get(task.id) || !!taskMetrics[task.id]
	const metrics = taskMetrics[task.id]

	return (
		<TableRow
			className={`${hasStarted ? "cursor-pointer hover:bg-muted/50" : ""} ${task.passed === false ? "bg-red-950/30 border-l-2 border-l-red-500" : ""}`}
			onClick={() => hasStarted && onViewTaskLog(task)}>
			<TableCell className="text-center text-muted-foreground font-mono text-xs">{originalIndex + 1}</TableCell>
			<TableCell>
				<div className="flex items-center gap-2">
					<TaskStatus task={task} running={hasStarted} />
					<div className="flex items-center gap-2">
						<span>
							{task.language}/{task.exercise}
							{task.iteration > 1 && (
								<span className="text-muted-foreground ml-1">(#{task.iteration})</span>
							)}
						</span>
						{hasStarted && (
							<Tooltip>
								<TooltipTrigger asChild>
									<FileText className="size-3 text-muted-foreground" />
								</TooltipTrigger>
								<TooltipContent>Click to view log</TooltipContent>
							</Tooltip>
						)}
					</div>
				</div>
			</TableCell>
			{metrics ? (
				<>
					<TableCell className="font-mono text-xs">
						<div className="flex items-center justify-evenly">
							<div>{formatTokens(metrics.tokensIn)}</div>/<div>{formatTokens(metrics.tokensOut)}</div>
						</div>
					</TableCell>
					<TableCell className="font-mono text-xs">{formatTokens(metrics.tokensContext)}</TableCell>
					{toolColumns.map((toolName) => {
						const usage = resolveTaskToolUsage(task, toolUsage)?.[toolName]
						const successRate = usage ? getSuccessRate(usage) : 100
						const rateColor = getSuccessRateColor(successRate)
						return (
							<TableCell key={toolName} className="text-xs text-center">
								{usage ? (
									<div className="flex flex-col items-center">
										<span className="font-medium">{usage.attempts}</span>
										<span className={rateColor}>{formatToolUsageSuccessRate(usage)}</span>
									</div>
								) : (
									<span className="text-muted-foreground">-</span>
								)}
							</TableCell>
						)
					})}
					<TableCell className="font-mono text-xs">
						{metrics.duration ? formatDuration(metrics.duration) : "-"}
					</TableCell>
					<TableCell className="font-mono text-xs">{formatCurrency(metrics.cost)}</TableCell>
				</>
			) : (
				<TableCell colSpan={5 + toolColumns.length} />
			)}
		</TableRow>
	)
}
