import { Box, Newline, Text } from "ink"

import type { TUIMessage } from "../../types.js"
import * as theme from "../../theme.js"

import {
	CATEGORY_COLORS,
	getToolCategory,
	parseToolInfo,
	sanitizeContent,
	truncateContent,
	type ToolCategory,
} from "./chatHistoryHelpers.js"

interface ToolContentProps {
	toolDisplayOutput: string | undefined
	sanitizedRawContent: string | undefined
}

function ToolContent({ toolDisplayOutput, sanitizedRawContent }: ToolContentProps) {
	const contentToDisplay = toolDisplayOutput ?? sanitizedRawContent ?? ""
	const { text, truncated, totalLines } = truncateContent(contentToDisplay, 15)
	return (
		<>
			<Text color={theme.toolText}>{text}</Text>
			{truncated && <Text color={theme.dimText} dimColor>{`... (${totalLines - 15} more lines)`}</Text>}
		</>
	)
}

interface ToolPathIndicatorProps {
	path: string
	category: ToolCategory
	isOutsideWorkspace: boolean | undefined
}

function ToolPathIndicator({ path, category, isOutsideWorkspace }: ToolPathIndicatorProps) {
	const label = category === "file" ? "file: " : category === "directory" ? "dir: " : "path: "
	return (
		<Box marginLeft={2}>
			<Text color={theme.dimText}>{label}</Text>
			<Text color={theme.text} bold>
				{path}
			</Text>
			{isOutsideWorkspace && (
				<Text color={theme.warningColor} dimColor>
					{" (outside workspace)"}
				</Text>
			)}
		</Box>
	)
}

interface ToolDisplayBodyProps {
	categoryColor: string
	headerText: string
	path: string | undefined
	category: ToolCategory
	isOutsideWorkspace: boolean | undefined
	reason: string | undefined
	showContent: boolean
	toolDisplayOutput: string | undefined
	sanitizedRawContent: string | undefined
}

function ToolDisplayBody({
	categoryColor,
	headerText,
	path,
	category,
	isOutsideWorkspace,
	reason,
	showContent,
	toolDisplayOutput,
	sanitizedRawContent,
}: ToolDisplayBodyProps) {
	return (
		<Box flexDirection="column" paddingX={1}>
			<Text bold color={categoryColor}>
				{headerText}
			</Text>
			{path !== undefined && (
				<ToolPathIndicator path={path} category={category} isOutsideWorkspace={isOutsideWorkspace} />
			)}
			{reason !== undefined && (
				<Box marginLeft={2}>
					<Text color={theme.dimText} italic>
						{reason}
					</Text>
				</Box>
			)}
			{showContent && (
				<Box flexDirection="column" marginLeft={2} marginTop={0}>
					<ToolContent toolDisplayOutput={toolDisplayOutput} sanitizedRawContent={sanitizedRawContent} />
				</Box>
			)}
			<Text>
				<Newline />
			</Text>
		</Box>
	)
}

export function getShowContent(
	toolDisplayOutput: string | undefined,
	sanitizedRawContent: string | undefined,
): boolean {
	return toolDisplayOutput !== undefined || sanitizedRawContent !== undefined
}

export function ToolDisplay({ message }: { message: TUIMessage }) {
	const toolName = message.toolName || "unknown"
	const category = getToolCategory(toolName)
	const toolInfo = parseToolInfo(message.content || "")
	const path = toolInfo?.path as string | undefined
	const isOutsideWorkspace = toolInfo?.isOutsideWorkspace as boolean | undefined
	const reason = toolInfo?.reason as string | undefined
	const rawContent = toolInfo?.content as string | undefined
	const toolDisplayOutput = message.toolDisplayOutput ? sanitizeContent(message.toolDisplayOutput) : undefined
	const sanitizedRawContent = rawContent ? sanitizeContent(rawContent) : undefined
	const headerText = message.toolDisplayName || toolName
	return (
		<ToolDisplayBody
			categoryColor={CATEGORY_COLORS[category]}
			headerText={headerText}
			path={path}
			category={category}
			isOutsideWorkspace={isOutsideWorkspace}
			reason={reason}
			showContent={getShowContent(toolDisplayOutput, sanitizedRawContent)}
			toolDisplayOutput={toolDisplayOutput}
			sanitizedRawContent={sanitizedRawContent}
		/>
	)
}
