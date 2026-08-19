"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { ChartConfig, THEMES } from "./context"

function ChartIndicator({
	indicator,
	indicatorColor,
	hideIndicator,
	nestLabel,
}: {
	indicator: "line" | "dot" | "dashed"
	indicatorColor: string
	hideIndicator: boolean
	nestLabel: boolean
}) {
	if (hideIndicator) return null

	return (
		<div
			className={cn("shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]", {
				"h-2.5 w-2.5": indicator === "dot",
				"w-1": indicator === "line",
				"w-0 border-[1.5px] border-dashed bg-transparent": indicator === "dashed",
				"my-0.5": nestLabel && indicator === "dashed",
			})}
			style={
				{
					"--color-bg": indicatorColor,
					"--color-border": indicatorColor,
				} as React.CSSProperties
			}
		/>
	)
}

function ChartItemValue({ value }: { value: number }) {
	return <span className="font-mono font-medium tabular-nums text-foreground">{value.toLocaleString()}</span>
}

function ChartTooltipItemContent({
	item,
	itemConfig,
	indicatorColor,
	indicator,
	hideIndicator,
	nestLabel,
	tooltipLabel,
}: {
	item: { name?: string; dataKey?: string; value?: number }
	itemConfig?: { icon?: React.ComponentType; label?: React.ReactNode }
	indicatorColor: string
	indicator: "line" | "dot" | "dashed"
	hideIndicator: boolean
	nestLabel: boolean
	tooltipLabel: React.ReactNode
}) {
	return (
		<>
			{itemConfig?.icon ? (
				<itemConfig.icon />
			) : (
				<ChartIndicator
					indicator={indicator}
					indicatorColor={indicatorColor}
					hideIndicator={hideIndicator}
					nestLabel={nestLabel}
				/>
			)}
			<div className={cn("flex flex-1 justify-between leading-none", nestLabel ? "items-end" : "items-center")}>
				<div className="grid gap-1.5">
					{nestLabel ? tooltipLabel : null}
					<span className="text-muted-foreground">{itemConfig?.label || item.name}</span>
				</div>
				{item.value && <ChartItemValue value={item.value} />}
			</div>
		</>
	)
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
	const colorConfig = Object.keys(config).filter((key) => {
		const item = config[key]
		if (!item) return false
		return item.theme || item.color
	})
	if (!colorConfig.length) return null

	return (
		<style
			dangerouslySetInnerHTML={{
				__html: Object.entries(THEMES)
					.map(
						([theme, prefix]) =>
							`${prefix} [data-chart=${id}] {\n${colorConfig
								.map((key) => {
									const itemConfig = config[key]
									if (!itemConfig) return null
									const color =
										itemConfig.theme?.[theme as keyof typeof itemConfig.theme] || itemConfig.color
									return color ? `  --color-${key}: ${color};` : null
								})
								.filter(Boolean)
								.join("\n")}\n}`,
					)
					.join("\n"),
			}}
		/>
	)
}

export { ChartIndicator, ChartItemValue, ChartTooltipItemContent, ChartStyle }
