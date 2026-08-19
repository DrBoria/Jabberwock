"use client"

import {
	formatCurrency,
	formatDateTime,
	formatDuration,
	formatTokens,
	formatToolUsageSuccessRate,
} from "@/lib/formatters"
import type { Run as EvalsRun, TaskMetrics as EvalsTaskMetrics } from "@jabberwock/evals"
import type { ToolName } from "@jabberwock/types"
import { TableCell, TableRow } from "@/components/ui"

import type { ToolGroup } from "./run/types"
import { ToolGroupCell } from "./run/tool-group-cell"
import { useRunActions } from "./run/use-run-actions"
import { RunActions } from "./run/actions"

type RunProps = {
	run: EvalsRun
	taskMetrics: EvalsTaskMetrics | null
	toolColumns: ToolName[]
	toolGroups: ToolGroup[]
}

function getSuccessRateColor(successRate: number): string {
	if (successRate === 100) return "text-green-500"
	if (successRate >= 80) return "text-yellow-500"
	return "text-red-500"
}

export function Run({ run, taskMetrics, toolColumns, toolGroups }: RunProps) {
	const actions = useRunActions(run)

	return (
		<>
			<TableRow className="cursor-pointer hover:bg-muted/50" onClick={actions.handleRowClick}>
				<TableCell className="max-w-[200px] truncate">{run.model}</TableCell>
				<TableCell>{run.settings?.apiProvider ?? "-"}</TableCell>
				<TableCell className="text-sm text-muted-foreground whitespace-nowrap">
					{formatDateTime(run.createdAt)}
				</TableCell>
				<TableCell>{run.passed}</TableCell>
				<TableCell>{run.failed}</TableCell>
				<TableCell>
					{run.passed + run.failed > 0 && <SuccessRateCell passed={run.passed} failed={run.failed} />}
				</TableCell>
				<TableCell>
					{taskMetrics && (
						<div className="flex items-center gap-1">
							<span>{formatTokens(taskMetrics.tokensIn)}</span>/
							<span>{formatTokens(taskMetrics.tokensOut)}</span>
						</div>
					)}
				</TableCell>
				{toolGroups.map((group) => (
					<TableCell key={group.id} className="text-xs text-center">
						<ToolGroupCell group={group} taskMetrics={taskMetrics} />
					</TableCell>
				))}
				{toolColumns.map((toolName) => {
					const usage = taskMetrics?.toolUsage?.[toolName]
					const successRate =
						usage && usage.attempts > 0 ? ((usage.attempts - usage.failures) / usage.attempts) * 100 : 100
					return (
						<TableCell key={toolName} className="text-xs text-center">
							{usage ? (
								<div className="flex flex-col items-center">
									<span className="font-medium">{usage.attempts}</span>
									<span className={getSuccessRateColor(successRate)}>
										{formatToolUsageSuccessRate(usage)}
									</span>
								</div>
							) : (
								<span className="text-muted-foreground">-</span>
							)}
						</TableCell>
					)
				})}
				<TableCell>{taskMetrics && formatCurrency(taskMetrics.cost)}</TableCell>
				<TableCell>{taskMetrics && formatDuration(taskMetrics.duration)}</TableCell>
				<TableCell onClick={(e) => e.stopPropagation()}>
					<RunActions run={run} {...actions} />
				</TableCell>
			</TableRow>
		</>
	)
}

function SuccessRateCell({ passed, failed }: { passed: number; failed: number }) {
	const percent = (passed / (passed + failed)) * 100
	return <span className={getSuccessRateColor(percent)}>{percent.toFixed(1)}%</span>
}
