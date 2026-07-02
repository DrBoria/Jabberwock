import type { NotificationAsk, NotificationSay, TodoItem } from "@jabberwock/types"

import type { TUIMessage, ToolData } from "../types.js"
import { extractToolData, formatToolOutput, formatToolAskMessage } from "./tools.js"
import { parseTodosFromToolInfo } from "./todo-parser.js"

export function shouldSkipSay(
	say: NotificationSay,
	messageId: string,
	firstTextMessageSkipped: React.MutableRefObject<boolean>,
	isResuming: boolean,
	seenMessageIds: React.MutableRefObject<Set<string>>,
	partial: boolean,
): boolean {
	if (say === "checkpoint_saved" || say === "api_req_started") {
		return true
	}

	if (say === "user_feedback") {
		seenMessageIds.current.add(messageId)
		return true
	}

	if (say === "text" && !firstTextMessageSkipped.current && !isResuming) {
		firstTextMessageSkipped.current = true
		seenMessageIds.current.add(messageId)
		return true
	}

	if (seenMessageIds.current.has(messageId) && !partial) {
		return true
	}

	return false
}

export function shouldSkipAsk(
	messageId: string,
	ask: NotificationAsk,
	partial: boolean,
	seenMessageIds: React.MutableRefObject<Set<string>>,
): boolean {
	if (partial) {
		return true
	}

	if (seenMessageIds.current.has(messageId)) {
		return true
	}

	if (ask === "command_output") {
		seenMessageIds.current.add(messageId)
		return true
	}

	return false
}

export function getSayRole(
	say: NotificationSay,
	text: string,
	pendingCommandRef: React.MutableRefObject<string | null>,
): {
	role: TUIMessage["role"]
	toolName: string | undefined
	toolDisplayName: string | undefined
	toolDisplayOutput: string | undefined
	toolData: ToolData | undefined
} {
	if (say === "command_output") {
		const trackedCommand = pendingCommandRef.current
		pendingCommandRef.current = null
		return {
			role: "tool",
			toolName: "execute_command",
			toolDisplayName: "bash",
			toolDisplayOutput: text,
			toolData: { tool: "execute_command", command: trackedCommand ?? undefined, output: text },
		}
	}

	if (say === "reasoning") {
		return {
			role: "thinking",
			toolName: undefined,
			toolDisplayName: undefined,
			toolDisplayOutput: undefined,
			toolData: undefined,
		}
	}

	return {
		role: "assistant",
		toolName: undefined,
		toolDisplayName: undefined,
		toolDisplayOutput: undefined,
		toolData: undefined,
	}
}

export function buildToolMessage(
	messageId: string,
	text: string,
	currentTodos: TodoItem[],
	setTodos: (todos: TodoItem[]) => void,
	addMessage: (msg: TUIMessage) => void,
): void {
	let toolName: string | undefined
	let toolDisplayName: string | undefined
	let toolDisplayOutput: string | undefined
	let toolData: ToolData | undefined
	let todos: TodoItem[] | undefined
	let previousTodos: TodoItem[] | undefined
	let formattedContent = text || ""

	try {
		const toolInfo = JSON.parse(text) as Record<string, unknown>
		toolName = toolInfo.tool as string
		toolDisplayName = toolInfo.tool as string
		toolDisplayOutput = formatToolOutput(toolInfo)
		formattedContent = formatToolAskMessage(toolInfo)
		toolData = extractToolData(toolInfo)

		if (toolName === "update_todo_list" || toolName === "updateTodoList") {
			const parsedTodos = parseTodosFromToolInfo(toolInfo)
			if (parsedTodos && parsedTodos.length > 0) {
				todos = parsedTodos
				previousTodos = [...currentTodos]
				setTodos(parsedTodos)
			}
		}
	} catch {
		// Use raw text if not valid JSON
	}

	addMessage({
		id: messageId,
		role: "tool",
		content: formattedContent,
		toolName,
		toolDisplayName,
		toolDisplayOutput,
		originalType: "tool" as NotificationAsk,
		toolData,
		todos,
		previousTodos,
	})
}

export function processNonInteractiveAsk(
	messageId: string,
	ask: NotificationAsk,
	text: string,
	seenMessageIds: React.MutableRefObject<Set<string>>,
	currentTodos: TodoItem[],
	setTodos: (todos: TodoItem[]) => void,
	addMessage: (msg: TUIMessage) => void,
): void {
	seenMessageIds.current.add(messageId)

	if (ask === "tool") {
		buildToolMessage(messageId, text, currentTodos, setTodos, addMessage)
	} else {
		addMessage({
			id: messageId,
			role: "assistant",
			content: text ?? "",
			originalType: ask,
		})
	}
}

export function parseAskContent(
	ask: NotificationAsk,
	text: string,
): {
	questionText: string
	suggestions: Array<{ answer: string; mode?: string | null }> | undefined
} {
	if (ask === "followup") {
		try {
			const data = JSON.parse(text)
			return {
				questionText: data.question || text,
				suggestions: Array.isArray(data.suggest) ? data.suggest : undefined,
			}
		} catch {
			return { questionText: text, suggestions: undefined }
		}
	}

	if (ask === "tool") {
		try {
			const toolInfo = JSON.parse(text) as Record<string, unknown>
			return { questionText: formatToolAskMessage(toolInfo), suggestions: undefined }
		} catch {
			return { questionText: text, suggestions: undefined }
		}
	}

	return { questionText: text, suggestions: undefined }
}
