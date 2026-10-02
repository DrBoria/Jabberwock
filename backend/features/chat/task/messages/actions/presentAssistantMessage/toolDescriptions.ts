import { defaultModeSlug, getModeBySlug } from "@shared/modes"
import type { ToolUse } from "@shared/tools"

import { getReadFileToolDescription } from "@features/chat/tools"

export const TOOL_DESCRIPTION_MAP: Record<string, (block: ToolUse) => string> = {
	execute_command: (b) => `[${b.name} for '${b.params.command}']`,
	write_to_file: (b) => `[${b.name} for '${b.params.path}']`,
	list_files: (b) => `[${b.name} for '${b.params.path}']`,
	use_mcp_tool: (b) => `[${b.name} for '${b.params.server_name}']`,
	access_mcp_resource: (b) => `[${b.name} for '${b.params.server_name}']`,
	ask_followup_question: (b) => `[${b.name} for '${b.params.question}']`,
	codebase_search: (b) => `[${b.name} for '${b.params.query}']`,
	read_command_output: (b) => `[${b.name} for '${b.params.artifact_id}']`,
	apply_diff: (b) => (b.params?.path ? `[${b.name} for '${b.params.path}']` : `[${b.name}]`),
	analyze_image: (b) => `[${b.name} for '${b.params.path}']`,
	generate_image: (b) => `[${b.name} for '${b.params.path}']`,
	edit: (b) => `[${b.name} for '${b.params.file_path}']`,
	search_and_replace: (b) => `[${b.name} for '${b.params.file_path}']`,
	search_replace: (b) => `[${b.name} for '${b.params.file_path}']`,
	edit_file: (b) => `[${b.name} for '${b.params.file_path}']`,
	apply_patch: () => `[apply_patch]`,
	await_batch_completion: () => `[await_batch_completion]`,
	attempt_completion: () => `[attempt_completion]`,
	update_todo_list: () => `[update_todo_list]`,
	switch_mode: (b) =>
		`[${b.name} to '${b.params.mode_slug}'${b.params.reason ? ` because: ${b.params.reason}` : ""}]`,
	read_file: (b) => {
		if (b.nativeArgs) {
			return getReadFileToolDescription(b.name, b.nativeArgs as { path?: string })
		}
		return getReadFileToolDescription(b.name, b.params)
	},
	search_files: (b) =>
		`[${b.name} for '${b.params.regex}'${b.params.file_pattern ? ` in '${b.params.file_pattern}'` : ""}]`,
	new_task: (b) => {
		const mode = b.params.mode ?? defaultModeSlug
		const message = b.params.message ?? "(no message)"
		const modeName = getModeBySlug(mode)?.name ?? mode
		return `[${b.name} in ${modeName} mode: '${message}']`
	},
	delegate_task: (b) => {
		const task_id = b.params.task_id ?? "(no id)"
		const target_role = b.params.target_role ?? "(no role)"
		const message = b.params.message ?? "(no message)"
		return `[${b.name} task "${task_id}" to ${target_role}: '${message}']`
	},
	run_slash_command: (b) =>
		`[${b.name} for '${b.params.command}'${b.params.args ? ` with args: ${b.params.args}` : ""}]`,
	skill: (b) => `[${b.name} for '${b.params.skill}'${b.params.args ? ` with args: ${b.params.args}` : ""}]`,
}

export function createToolDescription(block: ToolUse): string {
	const handler = TOOL_DESCRIPTION_MAP[block.name]
	if (handler) {
		return handler(block)
	}
	return `[${block.name}]`
}
