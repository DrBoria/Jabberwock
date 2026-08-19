import { useTranslation } from "react-i18next"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"

interface CostTooltipProps {
	hasSubtasks: boolean
	aggregatedCost: number | undefined
	totalCost: number
	costBreakdown: string | undefined
}

export const CostTooltipContent = ({ hasSubtasks, aggregatedCost, totalCost, costBreakdown }: CostTooltipProps) => {
	const { t } = useTranslation()
	if (hasSubtasks) {
		return (
			<div>
				<div>{t("chat:costs.totalWithSubtasks", { cost: (aggregatedCost ?? totalCost).toFixed(2) })}</div>
				{costBreakdown && <div className="text-xs mt-1">{costBreakdown}</div>}
			</div>
		)
	}
	return <div>{t("chat:costs.total", { cost: totalCost.toFixed(2) })}</div>
}

interface CostDisplayProps {
	totalCost: number
	hasSubtasks: boolean
	aggregatedCost: number | undefined
	costBreakdown: string | undefined
}

export const CostDisplay = ({ totalCost, hasSubtasks, aggregatedCost, costBreakdown }: CostDisplayProps) => {
	const { t } = useTranslation()
	return (
		<>
			<span>·</span>
			<StandardTooltip
				content={
					<CostTooltipContent
						hasSubtasks={hasSubtasks}
						aggregatedCost={aggregatedCost}
						totalCost={totalCost}
						costBreakdown={costBreakdown}
					/>
				}
				side="top"
				sideOffset={8}>
				<span>
					${(aggregatedCost ?? totalCost).toFixed(2)}
					{hasSubtasks && (
						<span className="text-xs ml-1" title={t("chat:costs.includesSubtasks")}>
							*
						</span>
					)}
				</span>
			</StandardTooltip>
		</>
	)
}
