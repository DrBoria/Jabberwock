"use client"

import { Fragment } from "react"
import { LoaderCircle, List, Layers } from "lucide-react"

import type { Run } from "@jabberwock/evals"

import { Table, TableBody, TableCell, TableRow, Tooltip, TooltipContent, TooltipTrigger, Button } from "@/components/ui"

import { RunHeader, type Stats } from "./components/run-header"
import { RunTaskRow } from "./components/run-task-row"
import { RunTaskDialog, RunKillDialog } from "./components/run-dialog"
import { useRunState, type TaskStatusCategory } from "./use-run-state"

export function Run({ run }: { run: Run }) {
	const {
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
		statusOrder,
		isRunActive,
		onKillRun,
		onCopyLog,
		onViewTaskLog,
		runStatus,
		tasks,
		toolUsage,
	} = useRunState(run)

	return (
		<>
			<div>
				{!tasks ? (
					<LoaderCircle className="size-4 animate-spin" />
				) : (
					<>
						<div className="flex justify-end mb-2">
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										onClick={() => setGroupByStatus(!groupByStatus)}
										className="flex items-center gap-2">
										{groupByStatus ? (
											<>
												<List className="size-4" />
												<span>Show Order</span>
											</>
										) : (
											<>
												<Layers className="size-4" />
												<span>Group by Status</span>
											</>
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									{groupByStatus ? "Show tasks in run order" : "Group tasks by status"}
								</TooltipContent>
							</Tooltip>
						</div>
						<Table className="border">
							<RunHeader
								run={run}
								stats={stats as Stats | null}
								elapsedTime={elapsedTime}
								tasksLength={tasks.length}
								toolColumns={toolColumns}
								isRunActive={isRunActive ?? false}
								isKilling={isKilling}
								onKillClick={() => setShowKillDialog(true)}
								runStatus={runStatus}
							/>
							<TableBody>
								{groupByStatus && groupedTasks
									? statusOrder.map((status: TaskStatusCategory) => {
											const group = groupedTasks[status]
											if (group.length === 0) return null
											const { label, className } = statusLabels[status]
											return (
												<Fragment key={status}>
													<TableRow className="bg-muted/50 hover:bg-muted/50">
														<TableCell colSpan={6 + toolColumns.length} className="py-2">
															<span className={`font-semibold ${className}`}>
																{label} ({group.length})
															</span>
														</TableCell>
													</TableRow>
													{group.map(({ task, originalIndex }) => (
														<RunTaskRow
															key={task.id}
															task={task}
															originalIndex={originalIndex}
															taskMetrics={taskMetricsCache}
															toolColumns={toolColumns}
															toolUsage={toolUsage}
															onViewTaskLog={onViewTaskLog}
														/>
													))}
												</Fragment>
											)
										})
									: tasks.map((task, index) => (
											<RunTaskRow
												key={task.id}
												task={task}
												originalIndex={index}
												taskMetrics={taskMetricsCache}
												toolColumns={toolColumns}
												toolUsage={toolUsage}
												onViewTaskLog={onViewTaskLog}
											/>
										))}
							</TableBody>
						</Table>
					</>
				)}
			</div>

			<RunTaskDialog
				selectedTask={selectedTask}
				taskLog={taskLog}
				isLoadingLog={isLoadingLog}
				copied={copied}
				onCopyLog={onCopyLog}
				onClose={() => setSelectedTask(null)}
			/>

			<RunKillDialog
				showKillDialog={showKillDialog}
				isKilling={isKilling}
				onKillRun={onKillRun}
				onClose={setShowKillDialog}
			/>
		</>
	)
}
