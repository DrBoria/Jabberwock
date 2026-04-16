import type { TextContent, ReasoningContent, ToolUse, McpToolUse } from "../../shared/tools"

export type AssistantMessageContent = TextContent | ReasoningContent | ToolUse | McpToolUse
