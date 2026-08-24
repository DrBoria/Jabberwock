import { defaultModeSlug, getModeBySlug } from "@shared/modes"
import type { ToolUse } from "@shared/tools"

import { listFilesTool } from "@features/chat/tools"
import { readFileTool } from "@features/chat/tools"
import { readCommandOutputTool } from "@features/chat/tools"
import { writeToFileTool } from "@features/chat/tools"
import { editTool } from "@features/chat/tools"
import { searchReplaceTool } from "@features/chat/tools"
import { editFileTool } from "@features/chat/tools/EditFileTool"
import { applyPatchTool } from "@features/chat/tools"
import { searchFilesTool } from "@features/chat/tools"
import { executeCommandTool } from "@features/chat/tools"
import { useMcpToolTool } from "@features/chat/tools"
import { accessMcpResourceTool } from "@features/chat/tools"
import { askFollowupQuestionTool } from "@features/chat/tools"
import { switchModeTool } from "@features/chat/tools"
import { attemptCompletionTool } from "@features/chat/tools"
import { delegateTaskTool } from "@features/chat/tools"
import { awaitBatchCompletionTool } from "@features/chat/tools"
import { newTaskTool } from "@features/chat/tools"
import { updateTodoListTool } from "@features/chat/tools"
import { runSlashCommandTool } from "@features/chat/tools"
import { skillTool } from "@features/chat/tools"
import { generateImageTool } from "@features/chat/tools"
import { analyzeImageTool } from "@features/chat/tools"
import { applyDiffTool as applyDiffToolClass } from "@features/chat/tools/ApplyDiffTool"
import { codebaseSearchTool } from "@features/chat/tools"
import { thinkTool } from "@features/chat/tools"
import type { ToolName } from "@jabberwock/types"
import type { BaseTool } from "@features/chat/tools"

const TOOL_DESCRIPTION_MAP: Record<string, (block: ToolUse) => string> = {
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
			return readFileTool.getReadFileToolDescription(b.name, b.nativeArgs as { path?: string })
		}
		return readFileTool.getReadFileToolDescription(b.name, b.params)
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

function createToolDescription(block: ToolUse): string {
	const handler = TOOL_DESCRIPTION_MAP[block.name]
	if (handler) {
		return handler(block)
	}
	return `[${block.name}]`
}

interface ToolHandlerEntry {
	handler: BaseTool<ToolName>
	needsCheckpoint: boolean
}

const TOOL_HANDLER_MAP: Record<string, ToolHandlerEntry> = {
	write_to_file: { handler: writeToFileTool, needsCheckpoint: true },
	update_todo_list: { handler: updateTodoListTool, needsCheckpoint: false },
	apply_diff: { handler: applyDiffToolClass, needsCheckpoint: true },
	edit: { handler: editTool, needsCheckpoint: true },
	search_and_replace: { handler: editTool, needsCheckpoint: true },
	search_replace: { handler: searchReplaceTool, needsCheckpoint: true },
	edit_file: { handler: editFileTool, needsCheckpoint: true },
	apply_patch: { handler: applyPatchTool, needsCheckpoint: true },
	read_file: { handler: readFileTool, needsCheckpoint: false },
	list_files: { handler: listFilesTool, needsCheckpoint: false },
	codebase_search: { handler: codebaseSearchTool, needsCheckpoint: false },
	search_files: { handler: searchFilesTool, needsCheckpoint: false },
	execute_command: { handler: executeCommandTool, needsCheckpoint: false },
	read_command_output: { handler: readCommandOutputTool, needsCheckpoint: false },
	use_mcp_tool: { handler: useMcpToolTool, needsCheckpoint: false },
	access_mcp_resource: { handler: accessMcpResourceTool, needsCheckpoint: false },
	ask_followup_question: { handler: askFollowupQuestionTool, needsCheckpoint: false },
	switch_mode: { handler: switchModeTool, needsCheckpoint: false },
	await_batch_completion: { handler: awaitBatchCompletionTool, needsCheckpoint: false },
	new_task: { handler: newTaskTool, needsCheckpoint: true },
	delegate_task: { handler: delegateTaskTool, needsCheckpoint: true },
	attempt_completion: { handler: attemptCompletionTool, needsCheckpoint: false },
	think_tool: { handler: thinkTool, needsCheckpoint: false },
	run_slash_command: { handler: runSlashCommandTool, needsCheckpoint: false },
	skill: { handler: skillTool, needsCheckpoint: false },
	analyze_image: { handler: analyzeImageTool, needsCheckpoint: true },
	generate_image: { handler: generateImageTool, needsCheckpoint: true },
}

const mutatingTools = [
	"write_to_file",
	"apply_diff",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
	"apply_patch",
	"execute_command",
	"generate_image",
	"analyze_image",
]

export type { ToolHandlerEntry }
export { TOOL_DESCRIPTION_MAP, createToolDescription, TOOL_HANDLER_MAP, mutatingTools }
