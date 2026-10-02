import { Box, Text } from "ink"

import * as theme from "../../theme.js"

/**
 * Shared preview renderer for tool output.
 *
 * The four tool renderers (CommandTool, CompletionTool, GenericTool,
 * FileReadTool) all display a truncated preview of multi-line content followed
 * by a "... (N more lines)" footer. This component centralises that logic so
 * the renderers only describe their header/toolbar and delegate the preview
 * body to one place (see `local/no-duplicated-logic`).
 *
 * `bordered` wraps the lines in a single-line border box (used by CommandTool
 * to visually frame command output). The truncated footer is always rendered
 * outside the border.
 */
export function ToolPreview({
	preview,
	truncated,
	hiddenLines,
	bordered = false,
}: {
	preview: string
	truncated: boolean
	hiddenLines: number
	bordered?: boolean
}) {
	if (!preview) return null

	const lines = (
		<Box flexDirection="column">
			{preview.split("\n").map((line, i) => (
				<Text key={i} color={theme.toolText}>
					{line}
				</Text>
			))}
		</Box>
	)

	return (
		<Box flexDirection="column">
			{bordered ? (
				<Box flexDirection="column" borderStyle="single" borderColor={theme.borderColor} paddingX={1}>
					{lines}
				</Box>
			) : (
				lines
			)}
			{truncated && (
				<Text color={theme.dimText} dimColor>
					... ({hiddenLines} more lines)
				</Text>
			)}
		</Box>
	)
}
