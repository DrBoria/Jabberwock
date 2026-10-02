import type { ToolName } from "@jabberwock/types"
import type { Tool } from "@features/chat/tools"

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

export interface ToolHandlerEntry {
	handler: Tool<ToolName>
	needsCheckpoint: boolean
}

// NOTE: `handler` is a lazy getter, NOT an eagerly-captured value. The tool
// modules are reachable from this file through a circular import that closes
// via the top-level `@features/chat` barrel (which re-exports TOOL_HANDLER_MAP
// itself). If the tools barrel is the entry point of that cycle, the tool
// bindings (e.g. `readFileTool`) are still `undefined` when this module is
// evaluated, so capturing them by value here would freeze `undefined` forever.
// A getter reads the live ES module binding at access time (inside
// `dispatchToolExecution`), by which point every module has finished
// evaluating — so the real tool object is always returned regardless of the
// order in which the cycle is entered.
export const TOOL_HANDLER_MAP: Record<string, ToolHandlerEntry> = {
	write_to_file: {
		get handler() {
			return writeToFileTool
		},
		needsCheckpoint: true,
	},
	update_todo_list: {
		get handler() {
			return updateTodoListTool
		},
		needsCheckpoint: false,
	},
	apply_diff: {
		get handler() {
			return applyDiffToolClass
		},
		needsCheckpoint: true,
	},
	edit: {
		get handler() {
			return editTool
		},
		needsCheckpoint: true,
	},
	search_and_replace: {
		get handler() {
			return editTool
		},
		needsCheckpoint: true,
	},
	search_replace: {
		get handler() {
			return searchReplaceTool
		},
		needsCheckpoint: true,
	},
	edit_file: {
		get handler() {
			return editFileTool
		},
		needsCheckpoint: true,
	},
	apply_patch: {
		get handler() {
			return applyPatchTool
		},
		needsCheckpoint: true,
	},
	read_file: {
		get handler() {
			return readFileTool
		},
		needsCheckpoint: false,
	},
	list_files: {
		get handler() {
			return listFilesTool
		},
		needsCheckpoint: false,
	},
	codebase_search: {
		get handler() {
			return codebaseSearchTool
		},
		needsCheckpoint: false,
	},
	search_files: {
		get handler() {
			return searchFilesTool
		},
		needsCheckpoint: false,
	},
	execute_command: {
		get handler() {
			return executeCommandTool
		},
		needsCheckpoint: false,
	},
	read_command_output: {
		get handler() {
			return readCommandOutputTool
		},
		needsCheckpoint: false,
	},
	use_mcp_tool: {
		get handler() {
			return useMcpToolTool
		},
		needsCheckpoint: false,
	},
	access_mcp_resource: {
		get handler() {
			return accessMcpResourceTool
		},
		needsCheckpoint: false,
	},
	ask_followup_question: {
		get handler() {
			return askFollowupQuestionTool
		},
		needsCheckpoint: false,
	},
	switch_mode: {
		get handler() {
			return switchModeTool
		},
		needsCheckpoint: false,
	},
	await_batch_completion: {
		get handler() {
			return awaitBatchCompletionTool
		},
		needsCheckpoint: false,
	},
	new_task: {
		get handler() {
			return newTaskTool
		},
		needsCheckpoint: true,
	},
	delegate_task: {
		get handler() {
			return delegateTaskTool
		},
		needsCheckpoint: true,
	},
	attempt_completion: {
		get handler() {
			return attemptCompletionTool
		},
		needsCheckpoint: false,
	},
	think_tool: {
		get handler() {
			return thinkTool
		},
		needsCheckpoint: false,
	},
	run_slash_command: {
		get handler() {
			return runSlashCommandTool
		},
		needsCheckpoint: false,
	},
	skill: {
		get handler() {
			return skillTool
		},
		needsCheckpoint: false,
	},
	analyze_image: {
		get handler() {
			return analyzeImageTool
		},
		needsCheckpoint: true,
	},
	generate_image: {
		get handler() {
			return generateImageTool
		},
		needsCheckpoint: true,
	},
}

export const mutatingTools = [
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
