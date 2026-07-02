import { CircularProgress } from "@src/shared/ui/displays/circular-progress"
import { Table, TableBody, TableRow, TableCell } from "@src/shared/ui/displays/table"
import { formatLargeNumber } from "@src/utils/format/formatNumber"
import { ChevronUp, ChevronDown } from "lucide-react"
import { CostDisplay } from "./components-metrics"

export const TokenPercentage = ({
	contextWindow,
	contextTokens,
	reservedForOutput,
}: {
	contextWindow: number
	contextTokens: number
	reservedForOutput: number
}) => {
	const availableInputSpace = contextWindow - reservedForOutput
	const percentage = availableInputSpace > 0 ? Math.round(((contextTokens || 0) / availableInputSpace) * 100) : 0
	return (
		<>
			<CircularProgress progress={percentage / 100} />
			<span>{percentage}%</span>
		</>
	)
}

export const ContextWindowTooltipContent = ({
	contextWindow,
	contextTokens,
	reservedForOutput,
}: {
	contextWindow: number
	contextTokens: number
	reservedForOutput: number
}) => {
	const availableSpace = contextWindow - (contextTokens || 0) - reservedForOutput
	return (
		<Table className="text-base ml-1.5">
			<TableBody>
				<TableRow>
					<TableCell className="font-medium whitespace-nowrap">Tokens Used</TableCell>
					<TableCell className="text-right text-[0.9em] font-mono">
						{formatLargeNumber(contextTokens || 0)} / {formatLargeNumber(contextWindow)}
					</TableCell>
				</TableRow>
				{reservedForOutput > 0 && (
					<TableRow>
						<TableCell className="font-medium whitespace-nowrap">Reserved for Response</TableCell>
						<TableCell className="text-right text-[0.9em] font-mono">
							{formatLargeNumber(reservedForOutput)}
						</TableCell>
					</TableRow>
				)}
				{availableSpace > 0 && (
					<TableRow>
						<TableCell className="font-medium whitespace-nowrap">Available Space</TableCell>
						<TableCell className="text-right text-[0.9em] font-mono">
							{formatLargeNumber(availableSpace)}
						</TableCell>
					</TableRow>
				)}
			</TableBody>
		</Table>
	)
}

export const CostSection = ({
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
		<>
			<span>·</span>
			<CostDisplay
				totalCost={totalCost}
				aggregatedCost={aggregatedCost}
				hasSubtasks={hasSubtasks}
				costBreakdown={costBreakdown}
			/>
		</>
	)
}

export const ExpandButton = ({ isExpanded, onToggle }: { isExpanded: boolean; onToggle: () => void }) => (
	<button
		onClick={onToggle}
		className="shrink-0 min-h-[20px] min-w-[20px] p-[2px] cursor-pointer opacity-85 hover:opacity-100 bg-transparent border-none rounded-md">
		{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} className="opacity-0 group-hover:opacity-100" />}
	</button>
)
