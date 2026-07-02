"use client"

import { LoaderCircle, StopCircle } from "lucide-react"

import type { Run } from "@jabberwock/evals"
import type { ToolName } from "@jabberwock/types"
import { formatCurrency, formatDuration, formatTokens } from "@/lib/formatters"
import type { RunStatus as _RunStatus } from "@/hooks/use-run-status"
import { Tooltip, TooltipContent, TooltipTrigger, Button, TableHead, TableHeader, TableRow } from "@/components/ui"

import { RunStatus as RunStatusBadge } from "../run-status"
import { getToolAbbreviation } from "./run-helpers"
import { RunToolUsageRow } from "./run-tool-usage-row"

import type { Stats } from "./run-header.types"

export type { Stats }

export function RunHeader({
	run,
	stats,
	elapsedTime,
	tasksLength,
	toolColumns,
	isRunActive,
	isKilling,
	onKillClick,
	runStatus,
}: {
	run: Run
	stats: Stats | null
	elapsedTime: number | null
	tasksLength: number
	toolColumns: ToolName[]
	isRunActive: boolean
	isKilling: boolean
	onKillClick: () => void
	runStatus: _RunStatus
}) {
	const providerName = run.settings?.apiProvider

	return (
		<TableHeader className="sticky top-0 z-10">
			{stats && (
				<TableRow>
					<TableHead colSpan={6 + toolColumns.length} className="bg-muted p-4">
						<div className="flex items-center justify-center gap-3 mb-3 relative">
							{providerName && <span className="text-sm text-muted-foreground">{providerName}</span>}
							<div className="font-mono">{run.model}</div>
							<RunStatusBadge runStatus={runStatus} isComplete={!!run.taskMetricsId} />
							{run.description && (
								<span className="text-sm text-muted-foreground">- {run.description}</span>
							)}
							{isRunActive && (
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											onClick={onKillClick}
											disabled={isKilling}
											className="absolute right-0 flex items-center gap-1 text-muted-foreground hover:text-destructive">
											{isKilling ? (
												<LoaderCircle className="size-4 animate-spin" />
											) : (
												<StopCircle className="size-4" />
											)}
											Kill
										</Button>
									</TooltipTrigger>
									<TooltipContent>Stop all containers for this run</TooltipContent>
								</Tooltip>
							)}
						</div>
						<RunStatsRow stats={stats} tasksLength={tasksLength} elapsedTime={elapsedTime} run={run} />
						<RunToolUsageRow toolUsage={stats.toolUsage} />
					</TableHead>
				</TableRow>
			)}
			<HeadersRow toolColumns={toolColumns} />
		</TableHeader>
	)
}

function RunStatsRow({
	stats,
	tasksLength,
	elapsedTime,
	run,
}: {
	stats: Stats
	tasksLength: number
	elapsedTime: number | null
	run: Run
}) {
	return (
		<div className="flex items-start justify-center gap-x-8 gap-y-3">
			<div className="text-center min-w-[160px]">
				<div className="text-2xl font-bold whitespace-nowrap">
					<span className="text-green-600">
						{stats.completed > 0 ? `${((stats.passed / stats.completed) * 100).toFixed(1)}%` : "-"}
					</span>
					<span className="text-muted-foreground mx-1">/</span>
					<span className="text-red-600">
						{stats.completed > 0 ? `${((stats.failed / stats.completed) * 100).toFixed(1)}%` : "-"}
					</span>
					<span className="text-muted-foreground mx-1">/</span>
					<span className="text-muted-foreground">
						{tasksLength > 0 ? `${((stats.remaining / tasksLength) * 100).toFixed(1)}%` : "-"}
					</span>
				</div>
				<div className="text-xs text-muted-foreground">
					<span className="text-green-600">{stats.passed}</span>
					{" / "}
					<span className="text-red-600">{stats.failed}</span>
					{" / "}
					<span>{stats.remaining}</span>
					{" of "}
					{tasksLength}
				</div>
			</div>
			<div className="text-center min-w-[140px]">
				<div className="text-xl font-bold font-mono whitespace-nowrap">
					{formatTokens(stats.totalTokensIn)}
					<span className="text-muted-foreground mx-1">/</span>
					{formatTokens(stats.totalTokensOut)}
				</div>
				<div className="text-xs text-muted-foreground">Tokens In / Out</div>
			</div>
			<div className="text-center min-w-[70px]">
				<div className="text-2xl font-bold font-mono">{formatCurrency(stats.totalCost)}</div>
				<div className="text-xs text-muted-foreground">Cost</div>
			</div>
			<div className="text-center min-w-[90px]">
				<div className="text-2xl font-bold font-mono whitespace-nowrap">
					{stats.totalDuration > 0 ? formatDuration(stats.totalDuration) : "-"}
				</div>
				<div className="text-xs text-muted-foreground">Duration</div>
			</div>
			<div className="text-center min-w-[90px]">
				<div className="text-2xl font-bold font-mono whitespace-nowrap">
					{elapsedTime !== null ? formatDuration(elapsedTime) : "-"}
				</div>
				<div className="text-xs text-muted-foreground">Elapsed</div>
			</div>
			{!run.taskMetricsId && elapsedTime !== null && stats.completed > 0 && stats.remaining > 0 && (
				<div className="text-center min-w-[90px]">
					<div className="text-2xl font-bold font-mono whitespace-nowrap text-muted-foreground">
						~{formatDuration((elapsedTime / stats.completed) * stats.remaining)}
					</div>
					<div className="text-xs text-muted-foreground">Est. Remaining</div>
				</div>
			)}
		</div>
	)
}

function HeadersRow({ toolColumns }: { toolColumns: ToolName[] }) {
	return (
		<TableRow>
			<TableHead className="w-12 text-center">#</TableHead>
			<TableHead>Exercise</TableHead>
			<TableHead className="text-center">Tokens In / Out</TableHead>
			<TableHead>Context</TableHead>
			{toolColumns.map((toolName) => (
				<TableHead key={toolName} className="text-xs text-center">
					<Tooltip>
						<TooltipTrigger>{getToolAbbreviation(toolName)}</TooltipTrigger>
						<TooltipContent>{toolName}</TooltipContent>
					</Tooltip>
				</TableHead>
			))}
			<TableHead>Duration</TableHead>
			<TableHead>Cost</TableHead>
		</TableRow>
	)
}
