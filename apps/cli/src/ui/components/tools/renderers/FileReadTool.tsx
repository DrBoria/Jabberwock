import { Box, Text } from "ink"

import * as theme from "../../../theme.js"
import { Icon } from "../../display/Icon.js"
import type { IconName } from "../../display/Icon.js"

import type { ToolRendererProps } from "../types.js"
import { truncateText, sanitizeContent, getToolDisplayName, getToolIconName } from "../utils.js"

const MAX_PREVIEW_LINES = 12

/**
 * Check if content looks like actual file content vs just path info
 * File content typically has newlines or is longer than a typical path
 */
function isActualContent(content: string, path: string): boolean {
	if (!content) return false
	// If content equals path or is just the path, it's not actual content
	if (content === path || content.endsWith(path)) return false
	// Check if it looks like a plain path (no newlines, starts with / or drive letter)
	if (!content.includes("\n") && (content.startsWith("/") || /^[A-Z]:\\/.test(content))) return false
	// Has newlines or doesn't look like a path - treat as content
	return content.includes("\n") || content.length > 200
}

function BatchFileList({ batchFiles }: { batchFiles: NonNullable<ToolRendererProps["toolData"]["batchFiles"]> }) {
	return (
		<Box flexDirection="column" marginLeft={2} marginTop={1}>
			{batchFiles.slice(0, 10).map((file, index) => (
				<Box key={index}>
					<Text color={theme.text} bold>
						{file.path}
					</Text>
					{file.lineSnippet && <Text color={theme.dimText}> ({file.lineSnippet})</Text>}
					{file.isOutsideWorkspace && (
						<Text color={theme.warningColor} dimColor>
							{" "}
							⚠ outside workspace
						</Text>
					)}
				</Box>
			))}
			{batchFiles.length > 10 && <Text color={theme.dimText}>... and {batchFiles.length - 10} more files</Text>}
		</Box>
	)
}

function SingleFileRead({
	iconName,
	displayName,
	path,
	isOutsideWorkspace,
	isList,
	content,
}: {
	iconName: string
	displayName: string
	path: string
	isOutsideWorkspace?: boolean
	isList: boolean
	content: string
}) {
	const { text: previewContent, truncated, hiddenLines } = truncateText(content, MAX_PREVIEW_LINES)

	return (
		<Box flexDirection="column" paddingX={1} marginBottom={1}>
			<Box>
				<Icon name={iconName as IconName} color={theme.toolHeader} />
				<Text bold color={theme.toolHeader}>
					{displayName}
				</Text>
				{path && (
					<>
						<Text color={theme.dimText}> · </Text>
						<Text color={theme.text} bold>
							{path}
						</Text>
						{isOutsideWorkspace && (
							<Text color={theme.warningColor} dimColor>
								{" "}
								⚠ outside workspace
							</Text>
						)}
					</>
				)}
			</Box>

			{previewContent && (
				<Box flexDirection="column" marginLeft={2} marginTop={1}>
					{isList ? (
						<Box flexDirection="column">
							{previewContent.split("\n").map((line, i) => (
								<Text key={i} color={theme.toolText}>
									{line}
								</Text>
							))}
						</Box>
					) : (
						<Box flexDirection="column">
							<Box borderStyle="single" borderColor={theme.borderColor} paddingX={1}>
								<Text color={theme.toolText}>{previewContent}</Text>
							</Box>
						</Box>
					)}

					{truncated && (
						<Text color={theme.dimText} dimColor>
							... ({hiddenLines} more lines)
						</Text>
					)}
				</Box>
			)}
		</Box>
	)
}

export function FileReadTool({ toolData }: ToolRendererProps) {
	const iconName = getToolIconName(toolData.tool)
	const displayName = getToolDisplayName(toolData.tool)
	const path = toolData.path || ""
	const rawContent = toolData.content ? sanitizeContent(toolData.content) : ""
	const isOutsideWorkspace = toolData.isOutsideWorkspace
	const isList = toolData.tool.includes("list") || toolData.tool.includes("List")
	const content = isActualContent(rawContent, path) ? rawContent : ""

	if (toolData.batchFiles && toolData.batchFiles.length > 0) {
		return (
			<Box flexDirection="column" paddingX={1}>
				<Box>
					<Icon name={iconName} color={theme.toolHeader} />
					<Text bold color={theme.toolHeader}>
						{" "}
						{displayName}
					</Text>
					<Text color={theme.dimText}> ({toolData.batchFiles.length} files)</Text>
				</Box>
				<BatchFileList batchFiles={toolData.batchFiles} />
			</Box>
		)
	}

	return (
		<SingleFileRead
			iconName={iconName}
			displayName={displayName}
			path={path}
			isOutsideWorkspace={isOutsideWorkspace}
			isList={isList}
			content={content}
		/>
	)
}
