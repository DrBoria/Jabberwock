import { z } from "zod"

/**
 * TokenUsage
 */

export const tokenUsageSchema = z.object({
	totalTokensIn: z.number(),
	totalTokensOut: z.number(),
	totalCacheWrites: z.number().optional(),
	totalCacheReads: z.number().optional(),
	totalCost: z.number(),
	contextTokens: z.number(),
})

export type TokenUsage = z.infer<typeof tokenUsageSchema>

/**
 * QueuedMessage
 */

export const queuedMessageSchema = z.object({
	timestamp: z.number(),
	id: z.string(),
	text: z.string(),
	images: z.array(z.string()).optional(),
})

export type QueuedMessage = z.infer<typeof queuedMessageSchema>

/**
 * ChatMessage — Discriminated Union Types
 *
 * The single collection for ALL chat content — user messages, agent responses,
 * MCP tool calls/results, system messages, streaming text.
 * Replaces the old "say" type in Notification.
 *
 * Common base fields (ALL message types):
 * - ts: timestamp — single ordering field
 * - type: discriminator
 * - text?: partial during streaming, complete when done
 * - images?: attached images
 *
 * @see architectural-restructure-v2.md §3
 */

/**
 * TokenCount
 */
export interface TokenCount {
	input: number
	output: number
	cacheWrites?: number
	cacheReads?: number
	total: number
}

/**
 * ToolCall — A tool invocation by the agent
 */
export interface ToolCall {
	id: string
	name: string
	input: string // JSON string of the tool input
}

/**
 * ToolResult — The result of executing a tool
 */
export interface ToolResult {
	toolCallId: string
	output: string
	isError: boolean
}

/**
 * McpToolInput — Input for an MCP tool call
 */
export interface McpToolInput {
	serverName: string
	toolName: string
	arguments?: Record<string, unknown>
}

/**
 * McpToolOutput — Output from an MCP tool call
 */
export interface McpToolOutput {
	content: string
	isError: boolean
}

/**
 * MessageBase — Common fields shared by all message types
 */
export interface MessageBase {
	ts: number
	type: "user" | "agent" | "mcp_tool" | "system"
	text?: string
	images?: string[]
}

/**
 * UserMessage — A message from the user (text + images)
 */
export interface UserMessage extends MessageBase {
	type: "user"
}

/**
 * AgentMessage — A response from the agent (with tool calls/results)
 */
export interface AgentMessage extends MessageBase {
	type: "agent"
	role: "agent"
	toolCalls: ToolCall[]
	toolResults: ToolResult[]
	cost: number
	tokensUsed: TokenCount
	finishReason: "completed" | "error" | "cancelled"
}

/**
 * McpToolMessage — An MCP tool invocation and its result
 */
export interface McpToolMessage extends MessageBase {
	type: "mcp_tool"
	serverName: string
	toolName: string
	input: McpToolInput
	output: McpToolOutput
	isError: boolean
}

/**
 * SystemMessage — A system-level message (checkpoint, condense, task control)
 */
export interface SystemMessage extends MessageBase {
	type: "system"
	subsystem: "checkpoint" | "condense" | "task_control"
}

/**
 * ChatMessage — Discriminated union of all chat message types
 */
export type ChatMessage = UserMessage | AgentMessage | McpToolMessage | SystemMessage
