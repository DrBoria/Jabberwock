import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui"
import { formatToolUsageSuccessRate } from "@/lib/formatters"

import { getToolAbbreviation, getSuccessRate, getSuccessRateColor, type ToolUsage } from "./run-helpers"

export function RunToolUsageRow({ toolUsage }: { toolUsage: ToolUsage }) {
	const entries = Object.keys(toolUsage)
	if (entries.length === 0) return null

	return (
		<div className="flex items-center justify-center gap-2 flex-wrap mt-3">
			{Object.entries(toolUsage)
				.sort(([, a], [, b]) => b.attempts - a.attempts)
				.map(([toolName, usage]) => {
					const abbr = getToolAbbreviation(toolName)
					const successRate = getSuccessRate(usage)
					const rateColor = getSuccessRateColor(successRate)
					return (
						<Tooltip key={toolName}>
							<TooltipTrigger asChild>
								<div className="flex items-center gap-1 px-2 py-1 rounded bg-background/50 border border-border/50 hover:border-border transition-colors cursor-default text-xs">
									<span className="font-medium text-muted-foreground">{abbr}</span>
									<span className="font-bold tabular-nums">{usage.attempts}</span>
									<span className={rateColor}>{formatToolUsageSuccessRate(usage)}</span>
								</div>
							</TooltipTrigger>
							<TooltipContent side="bottom">{toolName}</TooltipContent>
						</Tooltip>
					)
				})}
		</div>
	)
}
