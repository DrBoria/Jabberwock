import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { formatLargeNumber } from "@src/utils/format/formatNumber"
import { ContextWindowProgress } from "@/features/chat/topic/progress/context-window-progress"
import { prettyBytes } from "./helpers"
import { HardDriveDownload, HardDriveUpload } from "lucide-react"

export const CostTooltipBody = ({
	hasSubtasks,
	totalCost,
	aggregatedCost,
	costBreakdown,
}: {
	hasSubtasks: boolean
	totalCost: number
	aggregatedCost?: number
	costBreakdown?: string
}) =>
	hasSubtasks ? (
		<div>
			<div>Total (with subtasks): ${(aggregatedCost ?? totalCost).toFixed(2)}</div>
			{costBreakdown && <div className="text-xs mt-1">{costBreakdown}</div>}
		</div>
	) : (
		<div>Total: ${totalCost.toFixed(2)}</div>
	)

export const CostDisplay = ({
	totalCost,
	aggregatedCost,
	hasSubtasks,
	costBreakdown,
}: {
	totalCost: number
	aggregatedCost?: number
	hasSubtasks: boolean
	costBreakdown?: string
}) => (
	<StandardTooltip
		content={
			<CostTooltipBody
				hasSubtasks={hasSubtasks}
				totalCost={totalCost}
				aggregatedCost={aggregatedCost}
				costBreakdown={costBreakdown}
			/>
		}
		side="top"
		sideOffset={8}>
		<span>
			${(aggregatedCost ?? totalCost).toFixed(2)}
			{hasSubtasks && (
				<span className="text-xs ml-1" title="Includes subtasks">
					*
				</span>
			)}
		</span>
	</StandardTooltip>
)

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
}) => (
	<tr>
		<th
			className="font-medium text-left align-top w-1 whitespace-nowrap pr-3 h-[24px]"
			data-testid="context-window-label">
			Context Window
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

export const TokensRow = ({ tokensIn, tokensOut }: { tokensIn?: number; tokensOut?: number }) => (
	<tr>
		<th className="font-medium text-left align-top w-1 whitespace-nowrap pr-3 h-[24px]">Tokens</th>
		<td className="font-light align-top">
			<div className="flex items-center gap-1 flex-wrap">
				{typeof tokensIn === "number" && tokensIn > 0 && <span>↑ {formatLargeNumber(tokensIn)}</span>}
				{typeof tokensOut === "number" && tokensOut > 0 && <span>↓ {formatLargeNumber(tokensOut)}</span>}
			</div>
		</td>
	</tr>
)

export const CacheRow = ({ cacheReads, cacheWrites }: { cacheReads?: number; cacheWrites?: number }) => {
	const hasCacheReads = typeof cacheReads === "number" && cacheReads > 0
	const hasCacheWrites = typeof cacheWrites === "number" && cacheWrites > 0
	if (!hasCacheReads && !hasCacheWrites) return null
	return (
		<tr>
			<th className="font-medium text-left align-top w-1 whitespace-nowrap pr-3 h-[24px]">Cache</th>
			<td className="font-light align-top">
				<div className="flex items-center gap-1 flex-wrap">
					{hasCacheWrites && (
						<>
							<HardDriveDownload className="size-2.5" />
							<span>{formatLargeNumber(cacheWrites!)}</span>
						</>
					)}
					{hasCacheReads && (
						<>
							<HardDriveUpload className="size-2.5" />
							<span>{formatLargeNumber(cacheReads!)}</span>
						</>
					)}
				</div>
			</td>
		</tr>
	)
}

export const CostRow = ({
	totalCost,
	aggregatedCost,
	hasSubtasks,
	costBreakdown,
}: {
	totalCost?: number
	aggregatedCost?: number
	hasSubtasks: boolean
	costBreakdown?: string
}) => {
	if (!totalCost) return null
	return (
		<tr>
			<th className="font-medium text-left align-top w-1 whitespace-nowrap pr-3 h-[24px]">API Cost</th>
			<td className="font-light align-top">
				<CostDisplay
					totalCost={totalCost}
					aggregatedCost={aggregatedCost}
					hasSubtasks={hasSubtasks}
					costBreakdown={costBreakdown}
				/>
			</td>
		</tr>
	)
}

export const SizeRow = ({ size }: { size?: number }) => {
	if (!size || size <= 0) return null
	return (
		<tr>
			<th className="font-medium text-left align-top w-1 whitespace-nowrap pr-2 h-[20px]">Size</th>
			<td className="font-light align-top">{prettyBytes(size)}</td>
		</tr>
	)
}
