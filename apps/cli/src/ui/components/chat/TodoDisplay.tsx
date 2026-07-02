import { memo } from "react"
import { Box, Text } from "ink"

import type { TodoItem } from "@jabberwock/types"

import * as theme from "../../theme.js"
import ProgressBar from "../display/ProgressBar.js"
import { Icon, type IconName } from "../display/Icon.js"

/**
 * Map TODO status to Icon names
 */
const STATUS_ICON_NAMES: Record<TodoItem["status"], IconName> = {
	completed: "checkbox-checked",
	in_progress: "checkbox-progress",
	pending: "checkbox",
}

/**
 * Get the color for a TODO status
 */
function getStatusColor(status: TodoItem["status"]): string {
	switch (status) {
		case "completed":
			return theme.successColor
		case "in_progress":
			return theme.warningColor
		case "pending":
		default:
			return theme.dimText
	}
}

/**
 * Get the label for a status change
 */
function getStatusChangeLabel(status: TodoItem["status"]): string {
	switch (status) {
		case "completed":
			return "done"
		case "in_progress":
			return "started"
		default:
			return "reset"
	}
}

/**
 * Check if a todo item changed status compared to previous list
 */
function hasStatusChanged(todo: TodoItem, previousTodos: TodoItem[]): { statusChanged: boolean; isNew: boolean } {
	const previousTodo = previousTodos.find((p) => p.id === todo.id || p.content === todo.content)
	return {
		statusChanged: previousTodo !== undefined && previousTodo.status !== todo.status,
		isNew: previousTodos.length > 0 && previousTodo === undefined,
	}
}

interface TodoItemRowProps {
	todo: TodoItem
	previousTodos: TodoItem[]
}

/**
 * Render a single TODO item row
 */
function TodoItemRow({ todo, previousTodos }: TodoItemRowProps) {
	const iconName = STATUS_ICON_NAMES[todo.status] ?? STATUS_ICON_NAMES.pending
	const color = getStatusColor(todo.status)
	const { statusChanged, isNew } = hasStatusChanged(todo, previousTodos)

	return (
		<Box>
			<Icon name={iconName} color={color} />
			<Text color={color}> {todo.content}</Text>
			{statusChanged && (
				<Text color={theme.dimText} dimColor>
					{" ["}
					{getStatusChangeLabel(todo.status)}
					{"]"}
				</Text>
			)}
			{isNew && (
				<Text color={theme.dimText} dimColor>
					{" [new]"}
				</Text>
			)}
		</Box>
	)
}

/**
 * Filter todos to show only changed items
 */
function getFilteredChangedTodos(todos: TodoItem[], previousTodos: TodoItem[]): TodoItem[] {
	return todos.filter((todo) => {
		const previousTodo = previousTodos.find((p) => p.id === todo.id || p.content === todo.content)
		if (previousTodo === undefined) {
			return true
		}
		return previousTodo.status !== todo.status
	})
}

interface TodoDisplayProps {
	/** List of TODO items to display */
	todos: TodoItem[]
	/** Previous TODO list for diff comparison (optional) */
	previousTodos?: TodoItem[]
	/** Whether to show the progress bar (default: true) */
	showProgress?: boolean
	/** Whether to show only changed items (default: false) */
	showChangesOnly?: boolean
	/** Title to display in the header (default: "Progress") */
	title?: string
}

/**
 * TodoDisplay component for CLI
 *
 * Renders a beautiful TODO list visualization with:
 * - Nerd Font icons (or ASCII fallbacks) for status
 * - Color-coded items based on status (green/yellow/gray)
 * - Progress bar showing completion percentage
 * - Optional diff mode showing only changed items
 * - Change indicators ([done], [started], [new])
 *
 * Visual example (with fallback icons):
 * ```
 *  ☑ Progress [████████░░░░░░░░] 2/5
 *    ✓ Analyze requirements [done]
 *    ✓ Design architecture [done]
 *    → Implement core logic
 *    ○ Write tests
 *    ○ Update documentation [new]
 * ```
 */
function getDisplayTodos(todos: TodoItem[], showChangesOnly: boolean, previousTodos: TodoItem[]): TodoItem[] {
	if (showChangesOnly && previousTodos.length > 0) return getFilteredChangedTodos(todos, previousTodos)
	return todos
}

function TodoDisplay({
	todos,
	previousTodos = [],
	showProgress = true,
	showChangesOnly = false,
	title = "Progress",
}: TodoDisplayProps) {
	if (!todos) return null
	if (todos.length === 0) return null
	const displayTodos = getDisplayTodos(todos, showChangesOnly, previousTodos)
	if (displayTodos.length === 0) return null
	const totalCount = todos.length
	const completedCount = todos.filter((t) => t.status === "completed").length
	return (
		<Box flexDirection="column" paddingX={1} marginBottom={1}>
			<Box>
				<Icon name="todo-list" color={theme.toolHeader} />
				<Text color={theme.toolHeader} bold>
					{" "}
					{title}
				</Text>
				{showProgress && (
					<>
						<Text> </Text>
						<ProgressBar value={completedCount} max={totalCount} width={16} />
					</>
				)}
			</Box>
			<Box flexDirection="column" paddingLeft={1} marginTop={1}>
				{displayTodos.map((todo, index) => (
					<Box key={todo.id || `todo-${index}`}>
						<TodoItemRow todo={todo} previousTodos={previousTodos} />
					</Box>
				))}
			</Box>
		</Box>
	)
}

export default memo(TodoDisplay)
