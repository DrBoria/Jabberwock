"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"
import { useChart } from "./context"
import { getPayloadConfigFromPayload, computeTooltipLabelValue } from "./utils"
import { ChartTooltipItemContent } from "./components"

function resolveItemKey(nameKey: string | undefined, item: { name?: string; dataKey?: string }): string {
	return `${nameKey || item.name || item.dataKey || "value"}`
}

function resolveIndicatorColor(
	color: string | undefined,
	item: { payload?: { fill?: string }; color?: string },
): string {
	return color || item.payload?.fill || item.color || ""
}

const ChartTooltipContent = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
		React.ComponentProps<"div"> & {
			hideLabel?: boolean
			hideIndicator?: boolean
			indicator?: "line" | "dot" | "dashed"
			nameKey?: string
			labelKey?: string
		}
>(
	(
		{
			active,
			payload,
			className,
			indicator = "dot",
			hideLabel = false,
			hideIndicator = false,
			label,
			labelFormatter,
			labelClassName,
			formatter,
			color,
			nameKey,
			labelKey,
		},
		ref,
	) => {
		const { config } = useChart()

		const tooltipLabel = React.useMemo(() => {
			if (hideLabel || !payload?.length) return null

			const value = computeTooltipLabelValue(config, payload, label, labelKey)

			if (labelFormatter)
				return <div className={cn("font-medium", labelClassName)}>{labelFormatter(value, payload)}</div>
			if (!value) return null

			return <div className={cn("font-medium", labelClassName)}>{value}</div>
		}, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey])

		if (!active || !payload?.length) return null

		const nestLabel = payload.length === 1 && indicator !== "dot"

		return (
			<div
				ref={ref}
				className={cn(
					"grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
					className,
				)}>
				{!nestLabel ? tooltipLabel : null}
				<div className="grid gap-1.5">
					{payload.map((item, index) => {
						const typedItem = item as {
							name?: string
							dataKey?: string
							value?: number
							payload?: { fill?: string }
							color?: string
						}
						const key = resolveItemKey(nameKey, typedItem)
						const itemConfig = getPayloadConfigFromPayload(config, item, key)
						const indicatorColor = resolveIndicatorColor(color, typedItem)

						return (
							<div
								key={item.dataKey}
								className={cn(
									"flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
									indicator === "dot" && "items-center",
								)}>
								{formatter && typedItem?.value !== undefined && typedItem.name ? (
									formatter(typedItem.value, typedItem.name, typedItem, index, payload)
								) : (
									<ChartTooltipItemContent
										item={typedItem}
										itemConfig={itemConfig}
										indicatorColor={indicatorColor}
										indicator={indicator}
										hideIndicator={hideIndicator}
										nestLabel={nestLabel}
										tooltipLabel={tooltipLabel}
									/>
								)}
							</div>
						)
					})}
				</div>
			</div>
		)
	},
)
ChartTooltipContent.displayName = "ChartTooltip"

const ChartLegendContent = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div"> &
		Pick<RechartsPrimitive.LegendProps, "payload" | "verticalAlign"> & {
			hideIcon?: boolean
			nameKey?: string
		}
>(({ className, hideIcon = false, payload, verticalAlign = "bottom", nameKey }, ref) => {
	const { config } = useChart()

	if (!payload?.length) return null

	return (
		<div
			ref={ref}
			className={cn(
				"flex items-center justify-center gap-4",
				verticalAlign === "top" ? "pb-3" : "pt-3",
				className,
			)}>
			{payload.map((item) => {
				const key = `${nameKey || item.dataKey || "value"}`
				const itemConfig = getPayloadConfigFromPayload(config, item, key)

				return (
					<div
						key={item.value}
						className={cn(
							"flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground",
						)}>
						{itemConfig?.icon && !hideIcon ? (
							<itemConfig.icon />
						) : (
							<div className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
						)}
						{itemConfig?.label}
					</div>
				)
			})}
		</div>
	)
})
ChartLegendContent.displayName = "ChartLegend"

export { ChartTooltipContent, ChartLegendContent }
