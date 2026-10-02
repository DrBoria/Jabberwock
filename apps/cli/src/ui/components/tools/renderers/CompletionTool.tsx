import { Box, Text } from "ink"

import * as theme from "../../../theme.js"

import type { ToolRendererProps } from "../types.js"
import { truncateText, sanitizeContent } from "../utils.js"
import { ToolPreview } from "../preview.js"

const MAX_CONTENT_LINES = 15

export function CompletionTool({ toolData }: ToolRendererProps) {
	const result = toolData.result ? sanitizeContent(toolData.result) : ""
	const question = toolData.question ? sanitizeContent(toolData.question) : ""
	const content = toolData.content ? sanitizeContent(toolData.content) : ""
	const isQuestion = toolData.tool.includes("question") || toolData.tool.includes("Question")
	const displayContent = result || question || content
	const { text: previewContent, truncated, hiddenLines } = truncateText(displayContent, MAX_CONTENT_LINES)

	if (!previewContent) return null

	return (
		<Box flexDirection="column" paddingX={1} marginBottom={1}>
			{isQuestion ? (
				<Box flexDirection="column">
					<Text color={theme.text}>{previewContent}</Text>
					{truncated && (
						<Text color={theme.dimText} dimColor>
							... ({hiddenLines} more lines)
						</Text>
					)}
				</Box>
			) : (
				<ToolPreview preview={previewContent} truncated={truncated} hiddenLines={hiddenLines} />
			)}
		</Box>
	)
}
