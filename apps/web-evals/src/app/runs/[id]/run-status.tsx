"use client"

import { Link2, Link2Off, CheckCircle2 } from "lucide-react"
import type { RunStatus as _RunStatus } from "@/hooks/use-run-status"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui"

function StreamIcon({ status }: { status: "connected" | "waiting" | "error" }) {
	if (status === "connected") {
		return <Link2 className="size-4 text-green-500" />
	}
	return <Link2Off className={cn("size-4", status === "waiting" ? "text-amber-500" : "text-rose-500")} />
}

function StatusDot({ active, label }: { active: boolean; label: string }) {
	return (
		<div className="flex items-center gap-2">
			<span className={active ? "text-green-500" : "text-rose-500"}>●</span>
			<span>{label}</span>
		</div>
	)
}

function RunStatusIndicator({
	sseStatus,
	heartbeat,
	runnerCount,
}: {
	sseStatus: "connected" | "waiting" | "error"
	heartbeat: string | null
	runnerCount: number
}) {
	return (
		<div className="flex items-center gap-2 cursor-default text-xs font-mono">
			<StreamIcon status={sseStatus} />
			<span className={heartbeat ? "text-green-500" : "text-rose-500"}>{heartbeat ?? "-"}</span>
			<span className={runnerCount > 0 ? "text-green-500" : "text-rose-500"}>
				{runnerCount > 0 ? `${runnerCount}r` : "0r"}
			</span>
		</div>
	)
}

function RunTooltipContent({
	sseStatus,
	heartbeat,
	runners,
}: {
	sseStatus: "connected" | "waiting" | "error"
	heartbeat: string | null
	runners: string[]
}) {
	return (
		<div className="space-y-1">
			<div className="flex items-center gap-2">
				<StreamIcon status={sseStatus} />
				<span>Task Stream: {sseStatus}</span>
			</div>
			<StatusDot active={!!heartbeat} label={`Task Controller: ${heartbeat ?? "dead"}`} />
			<StatusDot
				active={runners.length > 0}
				label={`Task Runners: ${runners.length > 0 ? runners.length : "none"}`}
			/>
			{runners.length > 0 && (
				<div className="mt-2 pt-2 border-t border-border text-muted-foreground space-y-0.5">
					{runners.map((runner) => (
						<div key={runner}>{runner}</div>
					))}
				</div>
			)}
		</div>
	)
}

export const RunStatus = ({
	runStatus: { sseStatus, heartbeat, runners = [] },
	isComplete = false,
}: {
	runStatus: _RunStatus
	isComplete?: boolean
}) => {
	if (isComplete) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<div className="flex items-center gap-1 cursor-default text-muted-foreground">
						<CheckCircle2 className="size-4" />
					</div>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="font-mono text-xs">
					Run complete
				</TooltipContent>
			</Tooltip>
		)
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<RunStatusIndicator sseStatus={sseStatus} heartbeat={heartbeat ?? null} runnerCount={runners.length} />
			</TooltipTrigger>
			<TooltipContent side="bottom" className="font-mono text-xs max-w-md">
				<RunTooltipContent sseStatus={sseStatus} heartbeat={heartbeat ?? null} runners={runners} />
			</TooltipContent>
		</Tooltip>
	)
}
