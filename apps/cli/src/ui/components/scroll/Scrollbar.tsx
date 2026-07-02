import { Box, Text } from "ink"
import * as theme from "../../theme.js"

export function Scrollbar({
	height,
	scrollbar,
	isActive,
}: {
	height: number
	scrollbar: { handleStart: number; handleHeight: number; maxScroll: number }
	isActive: boolean
}) {
	const handleColor = isActive ? theme.scrollActiveColor : theme.dimText
	const trackColor = theme.scrollTrackColor
	const showVisible = scrollbar.maxScroll > 0 || isActive
	return (
		<Box flexDirection="column" width={1} flexShrink={0} overflow="hidden">
			{showVisible &&
				height > 0 &&
				Array(height)
					.fill(null)
					.map((_, i) => {
						const isHandle =
							i >= scrollbar.handleStart && i < scrollbar.handleStart + scrollbar.handleHeight
						return (
							<Text key={i} color={isHandle ? handleColor : trackColor}>
								{isHandle ? "┃" : "│"}
							</Text>
						)
					})}
		</Box>
	)
}
