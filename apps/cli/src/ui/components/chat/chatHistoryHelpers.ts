import * as theme from "../../theme.js"

export type ToolCategory = "file" | "directory" | "search" | "command" | "mode" | "completion" | "other"

export const FILE_TOOLS = ["readFile", "read_file", "writeToFile", "write_to_file", "applyDiff", "apply_diff"]
export const DIR_TOOLS = ["listFiles", "list_files", "listFilesRecursive", "listFilesTopLevel"]
export const SEARCH_TOOLS = ["searchFiles", "search_files"]
export const COMMAND_TOOLS = ["executeCommand", "execute_command"]
export const MODE_TOOLS = ["switchMode", "switch_mode", "newTask", "new_task"]
export const COMPLETION_TOOLS = [
	"attemptCompletion",
	"attempt_completion",
	"askFollowupQuestion",
	"ask_followup_question",
]

export function getToolCategory(toolName: string): ToolCategory {
	if (FILE_TOOLS.includes(toolName)) return "file"
	if (DIR_TOOLS.includes(toolName)) return "directory"
	if (SEARCH_TOOLS.includes(toolName)) return "search"
	if (COMMAND_TOOLS.includes(toolName)) return "command"
	if (MODE_TOOLS.includes(toolName)) return "mode"
	if (COMPLETION_TOOLS.includes(toolName)) return "completion"
	return "other"
}

export const CATEGORY_COLORS: Record<ToolCategory, string> = {
	file: theme.toolHeader,
	directory: theme.toolHeader,
	search: theme.warningColor,
	command: theme.successColor,
	mode: theme.userHeader,
	completion: theme.successColor,
	other: theme.toolHeader,
}

export function sanitizeContent(text: string): string {
	let result = text.replace(/\t/g, "    ")
	result = result.replace(/\r/g, "")
	return result
}

export function truncateContent(
	content: string,
	maxLines: number = 10,
): { text: string; truncated: boolean; totalLines: number } {
	const lines = content.split("\n")
	const totalLines = lines.length
	if (lines.length <= maxLines) return { text: content, truncated: false, totalLines }
	return { text: lines.slice(0, maxLines).join("\n"), truncated: true, totalLines }
}

export function parseToolInfo(content: string): Record<string, unknown> | null {
	try {
		return JSON.parse(content)
	} catch {
		return null
	}
}
