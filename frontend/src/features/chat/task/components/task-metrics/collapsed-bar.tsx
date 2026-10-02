import { StandardTooltip } from "@src/shared/ui/tooltips/standard"
import { TokenTooltipContent, CircularPercentage } from "./tokens"
import { CostDisplay } from "./costs"
import { useTranslation } from "react-i18next"

interface CollapsedTaskBarProps {
	contextWindow: number
	contextTokens: number
	reservedForOutput: number
	condenseThresholdPercent: number
	totalCost: number | undefined
	hasSubtasks: boolean
	aggregatedCost: number | undefined
	costBreakdown: string | undefined
}

/**
 * Tricolor context bar:
 * - filled segment: used tokens
 * - middle segment: remaining until auto-compression threshold
 * - last segment: remaining until the full context window
 */
const ContextBar = ({
	contextWindow,
	contextTokens,
	reservedForOutput,
	condenseThresholdPercent,
}: Pick<
	CollapsedTaskBarProps,
	"contextWindow" | "contextTokens" | "reservedForOutput" | "condenseThresholdPercent"
>) => {
	const availableInputSpace = Math.max(contextWindow - reservedForOutput, 1)
	const used = Math.min(contextTokens || 0, availableInputSpace)
	const thresholdTokens = Math.round((availableInputSpace * condenseThresholdPercent) / 100)
	const usedPct = (used / availableInputSpace) * 100
	const toThresholdPct =
		(Math.max(Math.min(thresholdTokens, availableInputSpace) - used, 0) / availableInputSpace) * 100
	const toWindowPct = (Math.max(availableInputSpace - thresholdTokens - used, 0) / availableInputSpace) * 100
	return (
		<div className="flex-1 h-1.5 rounded-full overflow-hidden flex bg-vscode-input-background/60 min-w-[80px]">
			<div
				className="h-full bg-vscode-textLink-foreground transition-all duration-300"
				style={{ width: `${usedPct}%` }}
			/>
			<div
				className="h-full bg-vscode-charts-yellow/70 transition-all duration-300"
				style={{ width: `${toThresholdPct}%` }}
			/>
			<div
				className="h-full bg-vscode-charts-green/50 transition-all duration-300"
				style={{ width: `${toWindowPct}%` }}
			/>
		</div>
	)
}

export const CollapsedTaskBar = ({
	contextWindow,
	contextTokens,
	reservedForOutput,
	condenseThresholdPercent,
	totalCost,
	hasSubtasks,
	aggregatedCost,
	costBreakdown,
}: CollapsedTaskBarProps) => {
	const { t } = useTranslation()
	return (
		<div className="flex items-center gap-2 text-[11px] opacity-70">
			<StandardTooltip
				content={
					<TokenTooltipContent
						contextWindow={contextWindow}
						contextTokens={contextTokens}
						reservedForOutput={reservedForOutput}
						condenseThresholdPercent={condenseThresholdPercent}
					/>
				}
				side="top"
				sideOffset={8}>
				<div className="flex items-center gap-1.5 cursor-default w-full">
					<CircularPercentage
						contextWindow={contextWindow}
						reservedForOutput={reservedForOutput}
						contextTokens={contextTokens}
					/>
					<span className="shrink-0">/ {contextWindow.toLocaleString()}</span>
					<ContextBar
						contextWindow={contextWindow}
						contextTokens={contextTokens}
						reservedForOutput={reservedForOutput}
						condenseThresholdPercent={condenseThresholdPercent}
					/>
					<span className="shrink-0 opacity-70">
						{t("chat:task.condenseAt")}: {condenseThresholdPercent}%
					</span>
				</div>
			</StandardTooltip>
			{totalCost != null && (
				<CostDisplay
					totalCost={totalCost}
					hasSubtasks={hasSubtasks}
					aggregatedCost={aggregatedCost}
					costBreakdown={costBreakdown}
				/>
			)}
		</div>
	)
}
