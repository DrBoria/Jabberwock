import type { ToolData } from "../types.js"
import { TOOL_OUTPUT_FORMATTERS, TOOL_ASK_FORMATTERS, formatOutputDefault } from "./tool-formatters.js"

function setField(obj: Record<string, unknown>, key: string, target: Record<string, unknown>, targetKey: string): void {
	const value = obj[key]
	if (value !== undefined) {
		target[targetKey] = value
	}
}

/**
 * Extract structured ToolData from parsed tool JSON
 */
export function extractToolData(toolInfo: Record<string, unknown>): ToolData {
	const toolName = (toolInfo.tool as string) || "unknown"

	const toolData: ToolData = {
		tool: toolName,
		path: toolInfo.path as string | undefined,
		isOutsideWorkspace: toolInfo.isOutsideWorkspace as boolean | undefined,
		isProtected: toolInfo.isProtected as boolean | undefined,
		content: toolInfo.content as string | undefined,
		reason: toolInfo.reason as string | undefined,
	}

	const target = toolData as unknown as Record<string, unknown>
	setField(toolInfo, "diff", target, "diff")
	setField(toolInfo, "regex", target, "regex")
	setField(toolInfo, "filePattern", target, "filePattern")
	setField(toolInfo, "query", target, "query")
	setField(toolInfo, "mode", target, "mode")
	setField(toolInfo, "command", target, "command")
	setField(toolInfo, "output", target, "output")
	setField(toolInfo, "question", target, "question")
	setField(toolInfo, "result", target, "result")
	setField(toolInfo, "lineNumber", target, "lineNumber")
	setField(toolInfo, "additionalFileCount", target, "additionalFileCount")

	if (toolInfo.mode_slug !== undefined) {
		toolData.mode = toolInfo.mode_slug as string
	}

	if (toolInfo.diffStats !== undefined) {
		const stats = toolInfo.diffStats as { added?: number; removed?: number }
		if (typeof stats.added === "number" && typeof stats.removed === "number") {
			toolData.diffStats = { added: stats.added, removed: stats.removed }
		}
	}

	if (Array.isArray(toolInfo.files)) {
		toolData.batchFiles = (toolInfo.files as Array<Record<string, unknown>>).map((f) => ({
			path: (f.path as string) || "",
			lineSnippet: f.lineSnippet as string | undefined,
			isOutsideWorkspace: f.isOutsideWorkspace as boolean | undefined,
			key: f.key as string | undefined,
			content: f.content as string | undefined,
		}))
	}

	if (Array.isArray(toolInfo.batchDiffs)) {
		toolData.batchDiffs = (toolInfo.batchDiffs as Array<Record<string, unknown>>).map((d) => ({
			path: (d.path as string) || "",
			changeCount: d.changeCount as number | undefined,
			key: d.key as string | undefined,
			content: d.content as string | undefined,
			diffStats: d.diffStats as { added: number; removed: number } | undefined,
			diffs: d.diffs as Array<{ content: string; startLine?: number }> | undefined,
		}))
	}

	return toolData
}

/**
 * Format tool output for display
 */
export function formatToolOutput(toolInfo: Record<string, unknown>): string {
	const toolName = (toolInfo.tool as string) || "unknown"
	const formatter = TOOL_OUTPUT_FORMATTERS[toolName]
	if (formatter) {
		return formatter(toolInfo)
	}
	return formatOutputDefault(toolInfo)
}

/**
 * Format tool ask message for user approval prompt
 */
export function formatToolAskMessage(toolInfo: Record<string, unknown>): string {
	const toolName = (toolInfo.tool as string) || "unknown"
	const formatter = TOOL_ASK_FORMATTERS[toolName]
	if (formatter) {
		return formatter(toolInfo)
	}

	const params = Object.entries(toolInfo)
		.filter(([key]) => key !== "tool")
		.map(([key, value]) => {
			const displayValue = typeof value === "string" ? value : JSON.stringify(value)
			const truncated = displayValue.length > 80 ? `${displayValue.substring(0, 80)}...` : displayValue
			return `  ${key}: ${truncated}`
		})
		.join("\n")
	return `${toolName}${params ? `\n${params}` : ""}`
}
