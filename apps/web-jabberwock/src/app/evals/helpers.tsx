import { Cross } from "recharts"

type LabelPosition = "top" | "bottom" | "left" | "right"

export const renderQuadrant = (props: { width?: number; height?: number }) => {
	const w = props.width ?? 0
	const h = props.height ?? 0
	return (
		<Cross
			width={w}
			height={h}
			x={w / 2 + 35}
			y={h / 2 - 15}
			top={0}
			left={0}
			stroke="currentColor"
			opacity={0.1}
		/>
	)
}

export const renderCustomLabel = (
	props: { x?: string | number; y?: string | number; value?: string | number },
	position: LabelPosition,
) => {
	const { value } = props
	const x = Number(props.x ?? 0)
	const y = Number(props.y ?? 0)
	const maxWidth = 80

	const truncateText = (text: string, maxChars: number = 20) => {
		if (text.length <= maxChars) return text
		return text.substring(0, maxChars - 1) + "…"
	}

	let xOffset = 0
	let yOffset = 0
	let textAnchor: "middle" | "start" | "end" = "middle"
	let dominantBaseline: "auto" | "hanging" | "middle" = "auto"

	switch (position) {
		case "top":
			yOffset = -8
			textAnchor = "middle"
			dominantBaseline = "auto"
			break
		case "bottom":
			yOffset = 15
			textAnchor = "middle"
			dominantBaseline = "hanging"
			break
		case "left":
			xOffset = -8
			yOffset = 5
			textAnchor = "end"
			dominantBaseline = "middle"
			break
		case "right":
			xOffset = 15
			yOffset = 5
			textAnchor = "start"
			dominantBaseline = "middle"
			break
	}

	return (
		<text
			x={x + xOffset}
			y={y + yOffset}
			fontSize="11"
			fontWeight="500"
			fill="currentColor"
			opacity="0.8"
			textAnchor={textAnchor}
			dominantBaseline={dominantBaseline}
			style={{
				pointerEvents: "none",
				maxWidth: `${maxWidth}px`,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
			}}>
			{truncateText(String(value ?? ""))}
		</text>
	)
}

export const generateSpectrumColor = (index: number, total: number): string => {
	const hue = (index * 360) / total
	return `hsl(${Math.round(hue)}, 70%, 50%)`
}
