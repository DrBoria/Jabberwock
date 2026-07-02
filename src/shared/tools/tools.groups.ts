import type { ToolGroup, ToolName } from "@jabberwock/types"

// Define tool group configuration
export type ToolGroupConfig = {
	tools: readonly string[]
	alwaysAvailable?: boolean
	customTools?: readonly string[]
}

export const TOOL_DISPLAY_NAMES: Record<ToolName, string> = {
	execute_command: "run commands",
	read_file: "read files",
	read_command_output: "read command output",
	write_to_file: "write files",
	apply_diff: "apply changes",
	edit: "edit files",
	search_and_replace: "apply changes using search and replace",
	search_replace: "apply single search and replace",
	edit_file: "edit files using search and replace",
	apply_patch: "apply patches using codex format",
	search_files: "search files",
	list_files: "list files",
	use_mcp_tool: "use mcp tools",
	access_mcp_resource: "access mcp resources",
	ask_followup_question: "ask questions",
	await_batch_completion: "await batch completion",
	attempt_completion: "complete tasks",
	switch_mode: "switch modes",
	new_task: "create new task",
	delegate_task: "delegate task to specialized agent",
	codebase_search: "codebase search",
	update_todo_list: "update todo list",
	run_slash_command: "run slash command",
	skill: "load skill",
	generate_image: "generate images",
	analyze_image: "analyze images via vision model",
	custom_tool: "use custom tools",
	think_tool: "reason through complex problems",
} as const

export const TOOL_GROUPS: Record<ToolGroup, ToolGroupConfig> = {
	read: {
		tools: ["read_file", "search_files", "list_files", "codebase_search"],
	},
	edit: {
		tools: ["apply_diff", "write_to_file", "generate_image", "analyze_image"],
		customTools: ["edit", "search_replace", "edit_file", "apply_patch"],
	},
	command: {
		tools: ["execute_command", "read_command_output"],
	},
	mcp: {
		tools: ["use_mcp_tool", "access_mcp_resource"],
	},
	modes: {
		tools: ["switch_mode", "new_task"],
		alwaysAvailable: true,
	},
}

export const ALWAYS_AVAILABLE_TOOLS: ToolName[] = [
	"ask_followup_question",
	"attempt_completion",
	"await_batch_completion",
	"delegate_task",
	"update_todo_list",
	"run_slash_command",
	"skill",
	"think_tool",
] as const

export const TOOL_ALIASES: Record<string, ToolName> = {
	write_file: "write_to_file",
	search_and_replace: "edit",
} as const
