import { t } from "i18next"
import { ChevronDown, OctagonX } from "lucide-react"
import type { CommandExecutionStatus } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import { cn } from "@src/lib/utils"
import { Button } from "@src/shared/ui/buttons/button"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"

export const ExitStatusBadge = ({ status }: { status: CommandExecutionStatus | null }) => {
	if (status?.status !== "exited") return null
	return (
		<div className="flex flex-row items-center gap-2 font-mono text-xs">
			<StandardTooltip content={t("chat.commandExecution.exitStatus", { exitStatus: status.exitCode })}>
				<div className={cn("rounded-full size-2", status.exitCode === 0 ? "bg-green-600" : "bg-red-600")} />
			</StandardTooltip>
		</div>
	)
}

export const RunningStatusBar = ({ status }: { status: CommandExecutionStatus | null }) => {
	if (status?.status !== "started") return null
	return (
		<div className="flex flex-row items-center gap-2 font-mono text-xs">
			{status.pid && <div className="whitespace-nowrap">(PID: {status.pid})</div>}
			<StandardTooltip content={t("chat:commandExecution.abort")}>
				<Button variant="ghost" size="icon" onClick={() => rootStore.settings.terminalOperation("abort")}>
					<OctagonX className="size-4" />
				</Button>
			</StandardTooltip>
		</div>
	)
}

export const ExpandButton = ({
	isExpanded,
	output,
	onToggle,
}: {
	isExpanded: boolean
	output: string
	onToggle: () => void
}) => {
	if (output.length <= 0) return null
	return (
		<Button variant="ghost" size="icon" onClick={onToggle}>
			<ChevronDown className={cn("size-4 transition-transform duration-300", isExpanded && "rotate-180")} />
		</Button>
	)
}
