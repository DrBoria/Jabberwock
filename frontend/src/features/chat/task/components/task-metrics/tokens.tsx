import { useTranslation } from "react-i18next"
import { formatLargeNumber } from "@src/utils/format/formatNumber"
import { CircularProgress } from "@src/shared/ui/displays/circular-progress"
import { Table, TableBody, TableRow, TableCell } from "@src/shared/ui/displays/table"

interface TokenTooltipProps {
	contextWindow: number
	contextTokens: number
	reservedForOutput: number
}

export const TokenTooltipContent = ({ contextWindow, contextTokens, reservedForOutput }: TokenTooltipProps) => {
	const { t } = useTranslation()
	const availableSpace = contextWindow - (contextTokens || 0) - reservedForOutput
	return (
		<Table className="text-base ml-1.5">
			<TableBody>
				<TableRow>
					<TableCell className="font-medium whitespace-nowrap">
						{t("chat:tokenProgress.tokensUsedLabel")}
					</TableCell>
					<TableCell className="text-right text-[0.9em] font-mono">
						{formatLargeNumber(contextTokens || 0)} / {formatLargeNumber(contextWindow)}
					</TableCell>
				</TableRow>
				{reservedForOutput > 0 && (
					<TableRow>
						<TableCell className="font-medium whitespace-nowrap">
							{t("chat:tokenProgress.reservedForResponseLabel")}
						</TableCell>
						<TableCell className="text-right text-[0.9em] font-mono">
							{formatLargeNumber(reservedForOutput)}
						</TableCell>
					</TableRow>
				)}
				{availableSpace > 0 && (
					<TableRow>
						<TableCell className="font-medium whitespace-nowrap">
							{t("chat:tokenProgress.availableSpaceLabel")}
						</TableCell>
						<TableCell className="text-right text-[0.9em] font-mono">
							{formatLargeNumber(availableSpace)}
						</TableCell>
					</TableRow>
				)}
			</TableBody>
		</Table>
	)
}

interface CircularPercentageProps {
	contextWindow: number
	reservedForOutput: number
	contextTokens: number
}

export const CircularPercentage = ({ contextWindow, reservedForOutput, contextTokens }: CircularPercentageProps) => {
	const availableInputSpace = contextWindow - reservedForOutput
	const percentage = availableInputSpace > 0 ? Math.round(((contextTokens || 0) / availableInputSpace) * 100) : 0
	return (
		<>
			<CircularProgress progress={percentage / 100} />
			<span>{percentage}%</span>
		</>
	)
}
