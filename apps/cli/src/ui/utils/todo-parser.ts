import type { TodoItem } from "@jabberwock/types"

/**
 * Parse TODO items from tool info
 * Handles both array format and markdown checklist string format
 */
export function parseTodosFromToolInfo(toolInfo: Record<string, unknown>): TodoItem[] | null {
	const todosValue = toolInfo.todos
	if (Array.isArray(todosValue)) {
		return todosValue
			.map((item, index) => {
				if (typeof item === "object" && item !== null) {
					const todo = item as Record<string, unknown>
					return {
						id: (todo.id as string) || `todo-${index}`,
						content: (todo.content as string) || "",
						status: ((todo.status as string) || "pending") as TodoItem["status"],
					}
				}
				return null
			})
			.filter((item): item is TodoItem => item !== null)
	}

	const todosString = toolInfo.todos as string | undefined
	if (typeof todosString === "string") {
		return parseMarkdownChecklist(todosString)
	}

	return null
}

/**
 * Parse a markdown checklist string into TodoItem array
 * Format:
 *   [ ] pending item
 *   [-] in progress item
 *   [x] completed item
 */
export function parseMarkdownChecklist(markdown: string): TodoItem[] {
	const lines = markdown.split("\n")
	const todos: TodoItem[] = []

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		if (!line) {
			continue
		}

		const trimmedLine = line.trim()

		if (!trimmedLine) {
			continue
		}

		const checkboxMatch = trimmedLine.match(/^\[([x\-\s])\]\s*(.+)$/i)

		if (checkboxMatch) {
			const statusChar = checkboxMatch[1] ?? " "
			const content = checkboxMatch[2] ?? ""
			let status: TodoItem["status"] = "pending"

			if (statusChar.toLowerCase() === "x") {
				status = "completed"
			} else if (statusChar === "-") {
				status = "in_progress"
			}

			todos.push({ id: `todo-${i}`, content: content.trim(), status })
		}
	}

	return todos
}
