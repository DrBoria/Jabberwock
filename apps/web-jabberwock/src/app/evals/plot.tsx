"use client"

import { useMemo } from "react"
import { ScatterChart, Scatter, XAxis, YAxis, Customized, LabelList } from "recharts"

import { formatCurrency } from "@/lib"
import { ChartContainer, ChartTooltip, ChartConfig } from "@/components/ui"

import type { EvalRun } from "./types"
import { renderQuadrant, renderCustomLabel, generateSpectrumColor } from "./plot-helpers"

type PlotProps = {
	tableData: (EvalRun & { label: string; cost: number })[]
}

type LabelPosition = "top" | "bottom" | "left" | "right"

export const Plot = ({ tableData }: PlotProps) => {
	const chartData = useMemo(() => tableData.filter(({ cost }) => cost < 50), [tableData])

	const chartConfig = useMemo(
		() => chartData.reduce((acc, run) => ({ ...acc, [run.label]: run }), {} as ChartConfig),
		[chartData],
	)

	const labelPositions = useMemo(() => {
		const positions: Record<string, LabelPosition> = {}
		const placedLabels: Array<{ cost: number; score: number; label: string; position: LabelPosition }> = []

		const isCloseEnough = (p1: { cost: number; score: number }, p2: { cost: number; score: number }) => {
			const costDiff = Math.abs(p1.cost - p2.cost)
			const scoreDiff = Math.abs(p1.score - p2.score)
			return costDiff < 8 || scoreDiff < 10
		}

		const sameSideOverlap = (
			p1: { cost: number; score: number; position: LabelPosition },
			p2: { cost: number; score: number; position: LabelPosition },
		) => {
			const costDiff = Math.abs(p1.cost - p2.cost)
			const scoreDiff = Math.abs(p1.score - p2.score)
			if (costDiff >= 4 || scoreDiff >= 2.5) return false
			const sameTop = p1.position === "top" && p2.position === "top"
			const sameBottom = p1.position === "bottom" && p2.position === "bottom"
			return sameTop || sameBottom
		}

		const wouldLabelsOverlap = (
			p1: { cost: number; score: number; position: LabelPosition },
			p2: { cost: number; score: number; position: LabelPosition },
		): boolean => {
			if (!isCloseEnough(p1, p2)) return false
			const costDiff = Math.abs(p1.cost - p2.cost)
			const scoreDiff = Math.abs(p1.score - p2.score)
			if (p1.position === p2.position && costDiff < 4 && scoreDiff < 5) return true
			return sameSideOverlap(p1, p2)
		}

		const checkTopOverlap = (point: (typeof chartData)[0], other: (typeof chartData)[0]) => {
			const costDiff = Math.abs(point.cost - other.cost)
			return costDiff < 3 && other.score > point.score && other.score - point.score < 6
		}

		const checkBottomOverlap = (point: (typeof chartData)[0], other: (typeof chartData)[0]) => {
			const costDiff = Math.abs(point.cost - other.cost)
			return costDiff < 3 && other.score < point.score && point.score - other.score < 6
		}

		const checkLeftOverlap = (point: (typeof chartData)[0], other: (typeof chartData)[0]) => {
			const scoreDiff = Math.abs(point.score - other.score)
			return scoreDiff < 3 && other.cost < point.cost && point.cost - other.cost < 4
		}

		const checkRightOverlap = (point: (typeof chartData)[0], other: (typeof chartData)[0]) => {
			const scoreDiff = Math.abs(point.score - other.score)
			return scoreDiff < 3 && other.cost > point.cost && other.cost - point.cost < 4
		}

		const wouldOverlapPoint = (point: (typeof chartData)[0], position: LabelPosition): boolean => {
			const checkFn = {
				top: checkTopOverlap,
				bottom: checkBottomOverlap,
				left: checkLeftOverlap,
				right: checkRightOverlap,
			}[position]
			for (const other of chartData) {
				if (other.label === point.label) continue
				if (checkFn(point, other)) return true
			}
			return false
		}

		const sortedData = [...chartData].sort((a, b) => {
			const scoreDiff = b.score - a.score
			if (Math.abs(scoreDiff) > 1) return scoreDiff
			return a.cost - b.cost
		})

		sortedData.forEach((point) => {
			const positionPreferences: LabelPosition[] = ["top", "bottom", "right", "left"]
			let bestPosition: LabelPosition = "top"

			for (const position of positionPreferences) {
				let hasLabelOverlap = false
				for (const placed of placedLabels) {
					if (
						wouldLabelsOverlap(
							{ cost: point.cost, score: point.score, position },
							{ cost: placed.cost, score: placed.score, position: placed.position },
						)
					) {
						hasLabelOverlap = true
						break
					}
				}
				const hasPointOverlap = wouldOverlapPoint(point, position)
				if (!hasLabelOverlap && !hasPointOverlap) {
					bestPosition = position
					break
				}
			}

			positions[point.label] = bestPosition
			placedLabels.push({ cost: point.cost, score: point.score, label: point.label, position: bestPosition })
		})

		return positions
	}, [chartData])

	return (
		<>
			<div className="pt-4 pb-8 font-mono">Cost x Score</div>
			<ChartContainer config={chartConfig} className="h-[500px] w-full">
				<ScatterChart margin={{ top: 20, right: 0, bottom: 0, left: 20 }}>
					<XAxis
						type="number"
						dataKey="cost"
						name="Cost"
						domain={[
							(dataMin: number) => Math.max(0, Math.round((dataMin - 5) / 5) * 5),
							(dataMax: number) => Math.round((dataMax + 5) / 5) * 5,
						]}
						tickFormatter={(value) => formatCurrency(value)}
					/>
					<YAxis
						type="number"
						dataKey="score"
						name="Score"
						domain={[
							(dataMin: number) => Math.max(0, Math.round((dataMin - 5) / 5) * 5),
							(dataMax: number) => Math.min(100, Math.round((dataMax + 5) / 5) * 5),
						]}
						tickFormatter={(value) => `${value}%`}
					/>
					<ChartTooltip
						content={({ active, payload }) => {
							if (!active || !payload || !payload.length || !payload[0]) return null
							const { label, cost, score } = payload[0].payload
							return (
								<div className="bg-background border rounded-sm p-2 shadow-sm text-left">
									<div className="border-b pb-1">{label}</div>
									<div className="pt-1">
										<div>
											Score: <span className="font-mono">{Math.round(score)}%</span>
										</div>
										<div>
											Cost: <span className="font-mono">{formatCurrency(cost)}</span>
										</div>
									</div>
								</div>
							)
						}}
					/>
					<Customized component={renderQuadrant} />
					{chartData.map((d, index) => (
						<Scatter
							key={d.label}
							name={d.label}
							data={[d]}
							fill={generateSpectrumColor(index, chartData.length)}>
							<LabelList
								dataKey="label"
								content={(props) => renderCustomLabel(props, labelPositions[d.label] || "top")}
							/>
						</Scatter>
					))}
				</ScatterChart>
			</ChartContainer>
			<div className="py-4 text-xs opacity-50">
				(Note: Models with a cost of $50 or more are excluded from the scatter plot.)
			</div>
		</>
	)
}
