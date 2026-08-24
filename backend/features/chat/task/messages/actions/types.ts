import type { TextContent, ReasoningContent, ToolUse, McpToolUse } from "@shared/tools"

export type AssistantMessageContent = TextContent | ReasoningContent | ToolUse | McpToolUse

export type ContentBlockShape = {
	type: "file" | "folder" | "url" | "diagnostics" | "git_changes" | "git_commit" | "terminal" | "command"
	path?: string
	content: string
	metadata?: {
		totalLines: number
		returnedLines: number
		wasTruncated: boolean
		linesShown?: [number, number]
	}
}
