import type { IconName } from "../display/Icon.js"

/**
 * Truncate text and return truncation info
 */
export function truncateText(
	text: string,
	maxLines: number = 10,
): { text: string; truncated: boolean; totalLines: number; hiddenLines: number } {
	const lines = text.split("\n")
	const totalLines = lines.length

	if (lines.length <= maxLines) {
		return { text, truncated: false, totalLines, hiddenLines: 0 }
	}

	const truncatedText = lines.slice(0, maxLines).join("\n")
	return {
		text: truncatedText,
		truncated: true,
		totalLines,
		hiddenLines: totalLines - maxLines,
	}
}

/**
 * Sanitize content for terminal display
 * - Replaces tabs with spaces
 * - Strips carriage returns
 */
export function sanitizeContent(text: string): string {
	let result = text.replace(/\t/g, "    ")
	result = result.replace(/\r/g, "")
	return result
}

/**
 * Format diff stats as a colored string representation
 */
export function formatDiffStats(stats: { added: number; removed: number }): { added: string; removed: string } {
	return {
		added: `+${stats.added}`,
		removed: `-${stats.removed}`,
	}
}

/**
 * Get a friendly display name for a tool
 */
export function getToolDisplayName(toolName: string): string {
	const displayNames: Record<string, string> = {
		// File read operations
		readFile: "Read",
		read_file: "Read",
		skill: "Load Skill",
		listFilesTopLevel: "List Files",
		listFilesRecursive: "List Files (Recursive)",
		list_files: "List Files",

		// File write operations
		editedExistingFile: "Edit",
		appliedDiff: "Diff",
		apply_diff: "Diff",
		newFileCreated: "Create File",
		write_to_file: "Write File",
		writeToFile: "Write File",

		// Search operations
		searchFiles: "Search Files",
		search_files: "Search Files",
		codebaseSearch: "Codebase Search",
		codebase_search: "Codebase Search",

		// Command operations
		execute_command: "Execute Command",
		executeCommand: "Execute Command",

		// Mode operations
		switchMode: "Switch Mode",
		switch_mode: "Switch Mode",
		newTask: "New Task",
		new_task: "New Task",
		finishTask: "Finish Task",

		// Completion operations
		attempt_completion: "Task Complete",
		attemptCompletion: "Task Complete",
		ask_followup_question: "Question",
		askFollowupQuestion: "Question",

		// TODO operations
		update_todo_list: "Update TODO List",
		updateTodoList: "Update TODO List",
	}

	return displayNames[toolName] || toolName
}

/**
 * Get the IconName for a tool (for use with Icon component)
 */
export function getToolIconName(toolName: string): IconName {
	const iconNames: Record<string, IconName> = {
		// File read operations
		readFile: "file",
		read_file: "file",
		skill: "file",
		listFilesTopLevel: "folder",
		listFilesRecursive: "folder",
		list_files: "folder",

		// File write operations
		editedExistingFile: "file-edit",
		appliedDiff: "diff",
		apply_diff: "diff",
		newFileCreated: "file-edit",
		write_to_file: "file-edit",
		writeToFile: "file-edit",

		// Search operations
		searchFiles: "search",
		search_files: "search",
		codebaseSearch: "search",
		codebase_search: "search",

		// Command operations
		execute_command: "terminal",
		executeCommand: "terminal",

		// Mode operations
		switchMode: "switch",
		switch_mode: "switch",
		newTask: "switch",
		new_task: "switch",
		finishTask: "check",

		// Completion operations
		attempt_completion: "check",
		attemptCompletion: "check",
		ask_followup_question: "question",
		askFollowupQuestion: "question",

		// TODO operations
		update_todo_list: "check",
		updateTodoList: "check",
	}

	return iconNames[toolName] || "gear"
}

/**
 * Format a file path for display, optionally with workspace indicator
 */
export function formatPath(path: string, isOutsideWorkspace?: boolean, isProtected?: boolean): string {
	let result = path
	const badges: string[] = []

	if (isOutsideWorkspace) {
		badges.push("outside workspace")
	}

	if (isProtected) {
		badges.push("protected")
	}

	if (badges.length > 0) {
		result += ` (${badges.join(", ")})`
	}

	return result
}

/**
 * Parse diff content into structured hunks for rendering
 */
export interface DiffHunk {
	header: string
	lines: Array<{
		type: "context" | "added" | "removed" | "header"
		content: string
		lineNumber?: number
	}>
}

function classifyLine(line: string): { type: "added" | "removed" | "context"; content: string } | null {
	if (line.startsWith("@@")) {
		return null
	}
	if (line.startsWith("+") && !line.startsWith("+++")) {
		return { type: "added", content: line.substring(1) }
	}
	if (line.startsWith("-") && !line.startsWith("---")) {
		return { type: "removed", content: line.substring(1) }
	}
	if (line.startsWith(" ") || line === "") {
		return { type: "context", content: line.substring(1) || "" }
	}
	return null
}

export function parseDiff(diffContent: string): DiffHunk[] {
	const hunks: DiffHunk[] = []
	let currentHunk: DiffHunk | null = null

	for (const line of diffContent.split("\n")) {
		if (line.startsWith("@@")) {
			if (currentHunk) {
				hunks.push(currentHunk)
			}
			currentHunk = { header: line, lines: [] }
			continue
		}

		if (!currentHunk) {
			continue
		}

		const classified = classifyLine(line)
		if (classified) {
			currentHunk.lines.push(classified)
		}
	}

	if (currentHunk) {
		hunks.push(currentHunk)
	}

	return hunks
}
