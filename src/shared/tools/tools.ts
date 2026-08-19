import { Anthropic } from "@anthropic-ai/sdk"
import type { NotificationAsk, ToolProgressStatus, GenerateImageParams, ToolName } from "@jabberwock/types"

export type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>

export type AskApproval = (
	type: NotificationAsk,
	partialMessage?: string,
	progressStatus?: ToolProgressStatus,
	forceApproval?: boolean,
) => Promise<boolean>

export type HandleError = (action: string, error: Error) => Promise<void>

export type PushToolResult = (content: ToolResponse) => void

export type AskFinishSubTaskApproval = () => Promise<boolean>

export interface TextContent {
	type: "text"
	text: string
	partial: boolean
}

export interface ReasoningContent {
	type: "reasoning"
	text: string
	partial: boolean
}

export const toolParamNames = [
	"command",
	"path",
	"content",
	"regex",
	"file_pattern",
	"recursive",
	"action",
	"url",
	"coordinate",
	"text",
	"server_name",
	"tool_name",
	"arguments",
	"uri",
	"question",
	"result",
	"diff",
	"mode_slug",
	"reason",
	"line",
	"mode",
	"message",
	"cwd",
	"follow_up",
	"task",
	"size",
	"query",
	"args",
	"skill",
	"start_line",
	"end_line",
	"todos",
	"prompt",
	"image",
	"operations",
	"patch",
	"file_path",
	"old_string",
	"new_string",
	"replace_all",
	"expected_replacements",
	"timeout",
	"artifact_id",
	"search",
	"offset",
	"limit",
	"indentation",
	"anchor_line",
	"max_levels",
	"include_siblings",
	"include_header",
	"max_lines",
	"is_async",
	"task_id",
	"target_role",
	"files",
	"line_ranges",
] as const

export type ToolParamName = (typeof toolParamNames)[number]

export type NativeToolArgs = {
	access_mcp_resource: { server_name: string; uri: string }
	read_file: import("@jabberwock/types").ReadFileToolParams
	read_command_output: { artifact_id: string; search?: string; offset?: number; limit?: number }
	attempt_completion: { result: string }
	await_batch_completion: Record<string, never>
	execute_command: { command: string; cwd?: string; timeout?: number | null }
	apply_diff: { path: string; diff: string }
	edit: { file_path: string; old_string: string; new_string: string; replace_all?: boolean }
	search_and_replace: { file_path: string; old_string: string; new_string: string; replace_all?: boolean }
	search_replace: { file_path: string; old_string: string; new_string: string }
	edit_file: { file_path: string; old_string: string; new_string: string; expected_replacements?: number }
	apply_patch: { patch: string }
	list_files: { path: string; recursive?: boolean }
	new_task: { mode: string; message: string; todos?: string; is_async?: boolean }
	delegate_task: { task_id: string; target_role: string; message: string; is_async?: boolean }
	ask_followup_question: {
		question: string
		follow_up: Array<{ text: string; mode?: string }>
	}
	codebase_search: { query: string; path?: string }
	generate_image: GenerateImageParams
	analyze_image: { path: string; prompt?: string }
	run_slash_command: { command: string; args?: string }
	skill: { skill: string; args?: string }
	search_files: { path: string; regex: string; file_pattern?: string | null }
	switch_mode: { mode_slug: string; reason: string }
	update_todo_list: { todos: string }
	use_mcp_tool: { server_name: string; tool_name: string; arguments?: Record<string, unknown> }
	write_to_file: { path: string; content: string }
	think_tool: { prompt: string }
}

export interface ToolUse<TName extends ToolName = ToolName> {
	type: "tool_use"
	id?: string
	name: TName
	originalName?: string
	params: Partial<Record<ToolParamName, string>>
	partial: boolean
	nativeArgs?: TName extends keyof NativeToolArgs ? NativeToolArgs[TName] : never
	usedLegacyFormat?: boolean
}

export interface McpToolUse {
	type: "mcp_tool_use"
	id?: string
	name: string
	serverName: string
	toolName: string
	arguments: Record<string, unknown>
	partial: boolean
}

export type DiffResult =
	| { success: true; content: string; failParts?: DiffResult[] }
	| ({
			success: false
			error?: string
			details?: {
				similarity?: number
				threshold?: number
				matchedRange?: { start: number; end: number }
				searchContent?: string
				bestMatch?: string
			}
			failParts?: DiffResult[]
	  } & ({ error: string } | { failParts: DiffResult[] }))

export interface DiffItem {
	content: string
	startLine?: number
}

export interface DiffStrategy {
	getName(): string
	applyDiff(
		originalContent: string,
		diffContent: string | DiffItem[],
		startLine?: number,
		endLine?: number,
	): Promise<DiffResult>
	getProgressStatus?(toolUse: ToolUse, result?: DiffResult): ToolProgressStatus
}
