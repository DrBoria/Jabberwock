import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { TokenTooltipContent, CircularPercentage } from "./tokens"
import { CostDisplay } from "./costs"

interface CollapsedTaskBarProps {
	contextWindow: number
	contextTokens: number
	reservedForOutput: number
	totalCost: number | undefined
	hasSubtasks: boolean
	aggregatedCost: number | undefined
	costBreakdown: string | undefined
}

export const CollapsedTaskBar = ({
	contextWindow,
	contextTokens,
	reservedForOutput,
	totalCost,
	hasSubtasks,
	aggregatedCost,
	costBreakdown,
}: CollapsedTaskBarProps) => (
	<div className="flex items-center gap-2 text-[11px] opacity-70">
		<StandardTooltip
			content={
				<TokenTooltipContent
					contextWindow={contextWindow}
					contextTokens={contextTokens}
					reservedForOutput={reservedForOutput}
				/>
			}
			side="top"
			sideOffset={8}>
			<div className="flex items-center gap-1 cursor-default">
				<CircularPercentage
					contextWindow={contextWindow}
					reservedForOutput={reservedForOutput}
					contextTokens={contextTokens}
				/>
				<span>/ {contextWindow.toLocaleString()}</span>
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
