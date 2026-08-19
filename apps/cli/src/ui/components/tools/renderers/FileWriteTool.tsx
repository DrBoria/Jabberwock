import { Box, Text } from "ink"

import * as theme from "../../../theme.js"
import { Icon } from "../../display/Icon.js"
import type { IconName } from "../../display/Icon.js"

import type { ToolRendererProps } from "../types.js"
import { truncateText, sanitizeContent, getToolDisplayName, getToolIconName, parseDiff } from "../utils.js"

const MAX_DIFF_LINES = 15

function BatchDiffHeader({ iconName, displayName, count }: { iconName: string; displayName: string; count: number }) {
	return (
		<Box>
			<Icon name={iconName as IconName} color={theme.toolHeader} />
			<Text bold color={theme.toolHeader}>
				{" "}
				{displayName}
			</Text>
			<Text color={theme.dimText}> ({count} files)</Text>
		</Box>
	)
}

function BatchDiffList({ batchDiffs }: { batchDiffs: NonNullable<ToolRendererProps["toolData"]["batchDiffs"]> }) {
	return (
		<Box flexDirection="column" marginLeft={2} marginTop={1}>
			{batchDiffs.slice(0, 8).map((file, index) => (
				<Box key={index}>
					<Text color={theme.text} bold>
						{file.path}
					</Text>
					{file.diffStats && (
						<Box marginLeft={1}>
							<Text color={theme.successColor}>+{file.diffStats.added}</Text>
							<Text color={theme.dimText}> / </Text>
							<Text color={theme.errorColor}>-{file.diffStats.removed}</Text>
						</Box>
					)}
				</Box>
			))}
			{batchDiffs.length > 8 && <Text color={theme.dimText}>... and {batchDiffs.length - 8} more files</Text>}
		</Box>
	)
}

function DiffHunkRenderer({ diff }: { diff: string }) {
	const diffHunks = diff ? parseDiff(diff) : []

	if (diffHunks.length === 0) {
		return null
	}

	return (
		<Box flexDirection="column" marginLeft={2} marginTop={1}>
			{diffHunks.slice(0, 2).map((hunk, hunkIndex) => (
				<Box key={hunkIndex} flexDirection="column">
					<Text color={theme.focusColor} dimColor>
						{hunk.header}
					</Text>
					{hunk.lines.slice(0, 8).map((line, lineIndex) => (
						<Text
							key={lineIndex}
							color={
								line.type === "added"
									? theme.successColor
									: line.type === "removed"
										? theme.errorColor
										: theme.toolText
							}>
							{line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
							{line.content}
						</Text>
					))}
					{hunk.lines.length > 8 && (
						<Text color={theme.dimText} dimColor>
							... ({hunk.lines.length - 8} more lines in hunk)
						</Text>
					)}
				</Box>
			))}
			{diffHunks.length > 2 && (
				<Text color={theme.dimText} dimColor>
					... ({diffHunks.length - 2} more hunks)
				</Text>
			)}
		</Box>
	)
}

function RawDiffFallback({ diff }: { diff: string }) {
	const { text: previewDiff, truncated, hiddenLines } = truncateText(diff, MAX_DIFF_LINES)

	if (!previewDiff) {
		return null
	}

	return (
		<Box flexDirection="column" marginLeft={2} marginTop={1}>
			<Text color={theme.toolText}>{previewDiff}</Text>
			{truncated && (
				<Text color={theme.dimText} dimColor>
					... ({hiddenLines} more lines)
				</Text>
			)}
		</Box>
	)
}

function FileWriteHeader({
	iconName,
	displayName,
	path,
	isNewFile,
	diffStats,
	isProtected,
	isOutsideWorkspace,
}: {
	iconName: string
	displayName: string
	path: string
	isNewFile: boolean
	diffStats: ToolRendererProps["toolData"]["diffStats"]
	isProtected: boolean | undefined
	isOutsideWorkspace: boolean | undefined
}) {
	return (
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
				</>
			)}
			{isNewFile && (
				<Text color={theme.successColor} bold>
					{" "}
					NEW
				</Text>
			)}
			{diffStats && (
				<>
					<Text color={theme.dimText}> </Text>
					<Text color={theme.successColor} bold>
						+{diffStats.added}
					</Text>
					<Text color={theme.dimText}>/</Text>
					<Text color={theme.errorColor} bold>
						-{diffStats.removed}
					</Text>
				</>
			)}
			{isProtected && <Text color={theme.errorColor}> 🔒 protected</Text>}
			{isOutsideWorkspace && (
				<Text color={theme.warningColor} dimColor>
					{" "}
					⚠ outside workspace
				</Text>
			)}
		</Box>
	)
}

export function FileWriteTool({ toolData }: ToolRendererProps) {
	const iconName = getToolIconName(toolData.tool)
	const displayName = getToolDisplayName(toolData.tool)
	const path = toolData.path || ""
	const diffStats = toolData.diffStats
	const diff = toolData.diff ? sanitizeContent(toolData.diff) : ""
	const isProtected = toolData.isProtected
	const isOutsideWorkspace = toolData.isOutsideWorkspace
	const isNewFile = toolData.tool === "newFileCreated" || toolData.tool === "write_to_file"

	if (toolData.batchDiffs && toolData.batchDiffs.length > 0) {
		return (
			<Box flexDirection="column" paddingX={1}>
				<BatchDiffHeader iconName={iconName} displayName={displayName} count={toolData.batchDiffs.length} />
				<BatchDiffList batchDiffs={toolData.batchDiffs} />
			</Box>
		)
	}

	const diffHunks = diff ? parseDiff(diff) : []

	return (
		<Box flexDirection="column" paddingX={1} marginBottom={1}>
			<FileWriteHeader
				iconName={iconName}
				displayName={displayName}
				path={path}
				isNewFile={isNewFile}
				diffStats={diffStats}
				isProtected={isProtected}
				isOutsideWorkspace={isOutsideWorkspace}
			/>

			<DiffHunkRenderer diff={diff} />
			{diffHunks.length === 0 && <RawDiffFallback diff={diff} />}
		</Box>
	)
}
