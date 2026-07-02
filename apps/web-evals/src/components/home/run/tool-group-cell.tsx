"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui"
import type { TaskMetrics as EvalsTaskMetrics } from "@jabberwock/evals"
import type { ToolName } from "@jabberwock/types"
import type { ToolGroup } from "./types"

export function ToolGroupCell({ group, taskMetrics }: { group: ToolGroup; taskMetrics: EvalsTaskMetrics | null }) {
	if (!taskMetrics?.toolUsage) {
		return <span className="text-muted-foreground">-</span>
	}

	let totalAttempts = 0
	let totalFailures = 0
	const breakdown: Array<{ tool: string; attempts: number; rate: string }> = []

	for (const toolName of group.tools) {
		const usage = taskMetrics.toolUsage[toolName as ToolName]
		if (usage) {
			totalAttempts += usage.attempts
			totalFailures += usage.failures
			const rate =
				usage.attempts > 0 ? `${Math.round(((usage.attempts - usage.failures) / usage.attempts) * 100)}%` : "0%"
			breakdown.push({ tool: toolName, attempts: usage.attempts, rate })
		}
	}

	if (totalAttempts === 0) {
		return <span className="text-muted-foreground">-</span>
	}

	const successRate = ((totalAttempts - totalFailures) / totalAttempts) * 100
	const rateColor = getSuccessRateColor(successRate)

	return (
		<Tooltip>
			<TooltipTrigger>
				<div className="flex flex-col items-center">
					<span className="font-medium">{totalAttempts}</span>
					<span className={rateColor}>{Math.round(successRate)}%</span>
				</div>
			</TooltipTrigger>
			<TooltipContent>
				<div className="text-xs">
					<div className="font-semibold mb-1">{group.name}</div>
					{breakdown.map(({ tool, attempts, rate }) => (
						<div key={tool} className="flex justify-between gap-4">
							<span>{tool}:</span>
							<span>
								{attempts} ({rate})
							</span>
						</div>
					))}
				</div>
			</TooltipContent>
		</Tooltip>
	)
}

function getSuccessRateColor(successRate: number): string {
	if (successRate === 100) return "text-muted-foreground"
	if (successRate >= 80) return "text-yellow-500"
	return "text-red-500"
}
