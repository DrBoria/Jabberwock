import { useTranslation } from "react-i18next"
import prettyBytes from "pretty-bytes"
import { HardDriveDownload, HardDriveUpload } from "lucide-react"
import { formatLargeNumber } from "@src/utils/format/formatNumber"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { ContextWindowProgress } from "@src/features/chat/topic/progress/context-window-progress"
import { CostTooltipContent } from "./costs"

export const ContextWindowRow = ({
	contextWindow,
	contextTokens,
	maxTokens,
	condenseButton,
}: {
	contextWindow: number
	contextTokens: number
	maxTokens: number
	condenseButton: React.ReactNode
}) => {
	const { t } = useTranslation()
	if (contextWindow <= 0) return null
	return (
		<tr>
			<th
				className="font-medium text-left align-top w-1 whitespace-nowrap pr-3 h-[24px]"
				data-testid="context-window-label">
				{t("chat:task.contextWindow")}
			</th>
			<td className="font-light align-top">
				<div className="max-w-md -mt-1.5 flex flex-nowrap gap-1">
					<ContextWindowProgress
						contextWindow={contextWindow}
						contextTokens={contextTokens || 0}
						maxTokens={maxTokens || undefined}
					/>
					{condenseButton}
				</div>
			</td>
		</tr>
	)
}

export const TokensRow = ({ tokensIn, tokensOut }: { tokensIn: number | undefined; tokensOut: number | undefined }) => {
	const { t } = useTranslation()
	return (
		<tr>
			<th className="font-medium text-left align-top w-1 whitespace-nowrap pr-3 h-[24px]">
				{t("chat:task.tokens")}
			</th>
			<td className="font-light align-top">
				<div className="flex items-center gap-1 flex-wrap">
					{typeof tokensIn === "number" && tokensIn > 0 && <span>↑ {formatLargeNumber(tokensIn)}</span>}
					{typeof tokensOut === "number" && tokensOut > 0 && <span>↓ {formatLargeNumber(tokensOut)}</span>}
				</div>
			</td>
		</tr>
	)
}

export const CacheRow = ({
	cacheReads,
	cacheWrites,
}: {
	cacheReads: number | undefined
	cacheWrites: number | undefined
}) => {
	const { t } = useTranslation()
	const hasReads = typeof cacheReads === "number" && cacheReads > 0
	const hasWrites = typeof cacheWrites === "number" && cacheWrites > 0
	if (!hasReads && !hasWrites) return null
	return (
		<tr>
			<th className="font-medium text-left align-top w-1 whitespace-nowrap pr-3 h-[24px]">
				{t("chat:task.cache")}
			</th>
			<td className="font-light align-top">
				<div className="flex items-center gap-1 flex-wrap">
					{hasWrites && (
						<>
							<HardDriveDownload className="size-2.5" />
							<span>{formatLargeNumber(cacheWrites)}</span>
						</>
					)}
					{hasReads && (
						<>
							<HardDriveUpload className="size-2.5" />
							<span>{formatLargeNumber(cacheReads)}</span>
						</>
					)}
				</div>
			</td>
		</tr>
	)
}

export const CostRow = ({
	totalCost,
	hasSubtasks,
	aggregatedCost,
	costBreakdown,
}: {
	totalCost: number | undefined
	hasSubtasks: boolean
	aggregatedCost: number | undefined
	costBreakdown: string | undefined
}) => {
	const { t } = useTranslation()
	if (!totalCost) return null
	return (
		<tr>
			<th className="font-medium text-left align-top w-1 whitespace-nowrap pr-3 h-[24px]">
				{t("chat:task.apiCost")}
			</th>
			<td className="font-light align-top">
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
			</td>
		</tr>
	)
}

export const SizeRow = ({ size }: { size: number | undefined }) => {
	const { t } = useTranslation()
	if (!size || size <= 0) return null
	return (
		<tr>
			<th className="font-medium text-left align-top w-1 whitespace-nowrap pr-2 h-[20px]">
				{t("chat:task.size")}
			</th>
			<td className="font-light align-top">{prettyBytes(size)}</td>
		</tr>
	)
}

interface TaskMetricsTableProps {
	contextWindow: number
	contextTokens: number
	maxTokens: number
	condenseButton: React.ReactNode
	tokensIn: number | undefined
	tokensOut: number | undefined
	cacheReads: number | undefined
	cacheWrites: number | undefined
	totalCost: number | undefined
	hasSubtasks: boolean
	aggregatedCost: number | undefined
	costBreakdown: string | undefined
	currentTaskItemSize: number | undefined
}

export const TaskMetricsTable = ({
	contextWindow,
	contextTokens,
	maxTokens,
	condenseButton,
	tokensIn,
	tokensOut,
	cacheReads,
	cacheWrites,
	totalCost,
	hasSubtasks,
	aggregatedCost,
	costBreakdown,
	currentTaskItemSize,
}: TaskMetricsTableProps) => (
	<table className="w-full text-sm">
		<tbody>
			<ContextWindowRow
				contextWindow={contextWindow}
				contextTokens={contextTokens}
				maxTokens={maxTokens}
				condenseButton={condenseButton}
			/>
			<TokensRow tokensIn={tokensIn} tokensOut={tokensOut} />
			<CacheRow cacheReads={cacheReads} cacheWrites={cacheWrites} />
			<CostRow
				totalCost={totalCost}
				hasSubtasks={hasSubtasks}
				aggregatedCost={aggregatedCost}
				costBreakdown={costBreakdown}
			/>
			<SizeRow size={currentTaskItemSize} />
		</tbody>
	</table>
)
