import type { ToolFormatter } from "../types.js"

function formatSwitchMode(toolInfo: Record<string, unknown>): string {
	const mode = (toolInfo.mode as string) || "unknown"
	const reason = toolInfo.reason as string
	return `→ ${mode} mode${reason ? `\n  ${reason}` : ""}`
}

function formatSwitchModeSlug(toolInfo: Record<string, unknown>): string {
	const mode = (toolInfo.mode_slug as string) || (toolInfo.mode as string) || "unknown"
	const reason = toolInfo.reason as string
	return `→ ${mode} mode${reason ? `\n  ${reason}` : ""}`
}

function formatExecuteCommand(toolInfo: Record<string, unknown>): string {
	const command = toolInfo.command as string
	return `$ ${command || "(no command)"}`
}

function formatReadFile(toolInfo: Record<string, unknown>): string {
	const files = toolInfo.files as Array<{ path: string }> | undefined
	const path = toolInfo.path as string
	if (files && files.length > 0) {
		return files.map((f) => `📄 ${f.path}`).join("\n")
	}
	return `📄 ${path || "(no path)"}`
}

function formatWriteToFile(toolInfo: Record<string, unknown>): string {
	const writePath = toolInfo.path as string
	return `📝 ${writePath || "(no path)"}`
}

function formatApplyDiff(toolInfo: Record<string, unknown>): string {
	const diffPath = toolInfo.path as string
	return `✏️ ${diffPath || "(no path)"}`
}

function formatSearchFiles(toolInfo: Record<string, unknown>): string {
	const searchPath = toolInfo.path as string
	const regex = toolInfo.regex as string
	return `🔍 "${regex}" in ${searchPath || "."}`
}

function formatListFiles(toolInfo: Record<string, unknown>): string {
	const listPath = toolInfo.path as string
	const recursive = toolInfo.recursive as boolean
	return `📁 ${listPath || "."}${recursive ? " (recursive)" : ""}`
}

function formatAttemptCompletion(toolInfo: Record<string, unknown>): string {
	const result = toolInfo.result as string
	if (result) {
		const truncated = result.length > 100 ? `${result.substring(0, 100)}...` : result
		return `✅ ${truncated}`
	}
	return "✅ Task completed"
}

function formatAskFollowupQuestion(toolInfo: Record<string, unknown>): string {
	const question = toolInfo.question as string
	return `❓ ${question || "(no question)"}`
}

function formatNewTask(toolInfo: Record<string, unknown>): string {
	const taskMode = toolInfo.mode as string
	return `📋 Creating subtask${taskMode ? ` in ${taskMode} mode` : ""}`
}

function formatUpdateTodoList(): string {
	return "☑ TODO list updated"
}

function formatDefault(toolInfo: Record<string, unknown>): string {
	const params = Object.entries(toolInfo)
		.filter(([key]) => key !== "tool")
		.map(([key, value]) => {
			const displayValue = typeof value === "string" ? value : JSON.stringify(value)
			const truncated = displayValue.length > 100 ? `${displayValue.substring(0, 100)}...` : displayValue
			return `${key}: ${truncated}`
		})
		.join("\n")
	return params || "(no parameters)"
}

export const TOOL_OUTPUT_FORMATTERS: Record<string, ToolFormatter> = {
	switchMode: formatSwitchMode,
	switch_mode: formatSwitchModeSlug,
	execute_command: formatExecuteCommand,
	read_file: formatReadFile,
	write_to_file: formatWriteToFile,
	apply_diff: formatApplyDiff,
	search_files: formatSearchFiles,
	list_files: formatListFiles,
	attempt_completion: formatAttemptCompletion,
	ask_followup_question: formatAskFollowupQuestion,
	new_task: formatNewTask,
	update_todo_list: formatUpdateTodoList,
	updateTodoList: formatUpdateTodoList,
}

// ---- Ask message formatters ----

function formatAskSwitchMode(toolInfo: Record<string, unknown>): string {
	const mode = (toolInfo.mode as string) || (toolInfo.mode_slug as string) || "unknown"
	const reason = toolInfo.reason as string
	return `Switch to ${mode} mode?${reason ? `\nReason: ${reason}` : ""}`
}

function formatAskExecuteCommand(toolInfo: Record<string, unknown>): string {
	const command = toolInfo.command as string
	return `Run command?\n$ ${command || "(no command)"}`
}

function formatAskReadFile(toolInfo: Record<string, unknown>): string {
	const files = toolInfo.files as Array<{ path: string }> | undefined
	const path = toolInfo.path as string
	if (files && files.length > 0) {
		return `Read ${files.length} file(s)?\n${files.map((f) => `  ${f.path}`).join("\n")}`
	}
	return `Read file: ${path || "(no path)"}`
}

function formatAskWriteToFile(toolInfo: Record<string, unknown>): string {
	const writePath = toolInfo.path as string
	return `Write to file: ${writePath || "(no path)"}`
}

function formatAskApplyDiff(toolInfo: Record<string, unknown>): string {
	const diffPath = toolInfo.path as string
	return `Apply changes to: ${diffPath || "(no path)"}`
}

export const TOOL_ASK_FORMATTERS: Record<string, ToolFormatter> = {
	switchMode: formatAskSwitchMode,
	switch_mode: formatAskSwitchMode,
	execute_command: formatAskExecuteCommand,
	read_file: formatAskReadFile,
	write_to_file: formatAskWriteToFile,
	apply_diff: formatAskApplyDiff,
}

export { formatDefault as formatOutputDefault }
