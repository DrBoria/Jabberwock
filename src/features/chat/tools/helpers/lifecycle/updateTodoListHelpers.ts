import type { ITaskModel } from "@features/chat/task/store"
import { formatResponse } from "@features/settings/context/responses"
import cloneDeep from "clone-deep"
import crypto from "crypto"

import { TodoItem, TodoStatus, todoStatusSchema } from "@jabberwock/types"
import { getLatestTodo } from "@shared/misc/todo"
import { userBroadcast } from "@features/chat/task/messages/actions/say"

let approvedTodoList: TodoItem[] | undefined

import type { ToolResponse } from "@shared/tools"

export function getApprovedTodoList(): TodoItem[] | undefined {
	return approvedTodoList
}

export function setApprovedTodoList(todos: TodoItem[]): void {
	approvedTodoList = cloneDeep(todos)
}

function parseTodosRaw(todosRaw: string): { todos: TodoItem[] } | { error: string } {
	try {
		return { todos: parseMarkdownChecklist(todosRaw) }
	} catch {
		return { error: "The todos parameter is not valid markdown checklist or JSON" }
	}
}

export async function parseAndValidateTodos(
	todosRaw: string | undefined,
	task: ITaskModel,
	pushToolResult: (content: string) => void,
): Promise<{ normalizedTodos: TodoItem[] } | null> {
	const raw = todosRaw || ""
	const parseResult = parseTodosRaw(raw)
	if ("error" in parseResult) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("update_todo_list")
		task._state.setDidToolFailInCurrentTurn(true)
		pushToolResult(formatResponse.toolError(parseResult.error))
		return null
	}

	const { valid, error } = validateTodos(parseResult.todos)
	if (!valid) {
		task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
		task.recordToolError("update_todo_list")
		task._state.setDidToolFailInCurrentTurn(true)
		pushToolResult(formatResponse.toolError(error || "todos parameter validation failed"))
		return null
	}

	const normalizedTodos: TodoItem[] = parseResult.todos.map((t) => ({
		id: t.id,
		content: t.content,
		status: normalizeStatus(t.status),
	}))

	return { normalizedTodos }
}

export function isTodoListChanged(normalizedTodos: TodoItem[]): { changed: boolean; userEdited: TodoItem[] | null } {
	const approved = getApprovedTodoList()
	if (approved !== undefined && JSON.stringify(normalizedTodos) !== JSON.stringify(approved)) {
		return { changed: true, userEdited: approved ?? [] }
	}
	return { changed: false, userEdited: null }
}

export function broadcastTodoEdit(task: ITaskModel, todos: TodoItem[]): void {
	userBroadcast(
		task.taskId,
		"user_edit_todos",
		JSON.stringify({
			tool: "updateTodoList",
			todos,
		}),
	)
}

export function buildTodoResultMessage(changed: boolean, normalizedTodos: TodoItem[]): ToolResponse {
	if (changed) {
		return formatResponse.toolResult("User edits todo:\n\n" + todoListToMarkdown(normalizedTodos))
	}
	return formatResponse.toolResult("Todo list updated successfully.")
}

export function addTodoToTask(
	task: ITaskModel,
	content: string,
	status: TodoStatus = "pending",
	id?: string,
): TodoItem {
	const todo: TodoItem = {
		id: id ?? crypto.randomUUID(),
		content,
		status,
	}
	if (!task._state.todoList) task._state.setTodoList([])
	task._state.todoList!.push(todo)
	return todo
}

export function updateTodoStatusForTask(task: ITaskModel, id: string, nextStatus: TodoStatus): boolean {
	if (!task._state.todoList) return false
	const idx = task._state.todoList.findIndex((t) => t.id === id)
	if (idx === -1) return false
	const current = task._state.todoList[idx]
	if (
		(current.status === "pending" && nextStatus === "in_progress") ||
		(current.status === "in_progress" && nextStatus === "completed") ||
		current.status === nextStatus
	) {
		task._state.todoList[idx] = { ...current, status: nextStatus }
		return true
	}
	return false
}

export function removeTodoFromTask(task: ITaskModel, id: string): boolean {
	if (!task._state.todoList) return false
	const idx = task._state.todoList.findIndex((t) => t.id === id)
	if (idx === -1) return false
	task._state.todoList.splice(idx, 1)
	return true
}

export function getTodoListForTask(task: ITaskModel): TodoItem[] | undefined {
	return task._state.todoList?.slice()
}

export async function setTodoListForTask(task?: ITaskModel, todos?: TodoItem[]) {
	if (task === undefined) return
	task._state.setTodoList(Array.isArray(todos) ? todos : [])
}

export function restoreTodoListForTask(task: ITaskModel, todoList?: TodoItem[]) {
	if (todoList) {
		task._state.setTodoList(Array.isArray(todoList) ? todoList : [])
		return
	}
	task._state.setTodoList(getLatestTodo(task.messages))
}

function todoListToMarkdown(todos: TodoItem[]): string {
	return todos
		.map((t) => {
			let box = "[ ]"
			if (t.status === "completed") box = "[x]"
			else if (t.status === "in_progress") box = "[-]"
			return `${box} ${t.content}`
		})
		.join("\n")
}

function normalizeStatus(status: string | undefined): TodoStatus {
	if (status === "completed") return "completed"
	if (status === "in_progress") return "in_progress"
	return "pending"
}

export function parseMarkdownChecklist(md: string): TodoItem[] {
	if (typeof md !== "string") return []
	const lines = md
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean)
	const todos: TodoItem[] = []
	for (const line of lines) {
		const match = line.match(/^(?:-\s*)?\[\s*([ xX\-~])\s*\]\s+(.+)$/)
		if (!match) continue
		let status: TodoStatus = "pending"
		if (match[1] === "x" || match[1] === "X") status = "completed"
		else if (match[1] === "-" || match[1] === "~") status = "in_progress"
		const id = crypto
			.createHash("md5")
			.update(match[2] + status)
			.digest("hex")
		todos.push({
			id,
			content: match[2],
			status,
		})
	}
	return todos
}

export function setPendingTodoList(todos: TodoItem[]) {
	approvedTodoList = todos
}

function validateTodoItem(t: { [key: string]: unknown }, i: number): { valid: boolean; error?: string } | null {
	if (t === null || typeof t !== "object") return { valid: false, error: `Item ${i + 1} is not an object` }
	if (typeof t.id !== "string") return { valid: false, error: `Item ${i + 1} is missing id` }
	if (typeof t.content !== "string") return { valid: false, error: `Item ${i + 1} is missing content` }
	if (t.status !== undefined && !todoStatusSchema.options.includes(t.status as TodoStatus))
		return { valid: false, error: `Item ${i + 1} has invalid status` }
	return null
}

function validateTodos(todos: { [key: string]: unknown }[]): { valid: boolean; error?: string } {
	if (!Array.isArray(todos)) return { valid: false, error: "todos must be an array" }
	for (const [i, t] of todos.entries()) {
		const err = validateTodoItem(t, i)
		if (err) return err
	}
	return { valid: true }
}
