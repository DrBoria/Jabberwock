import { ArrowRight, Check, SquareDashed } from "lucide-react"

export type TodoStatus = "completed" | "in_progress" | "pending"

/**
 * Icon for a todo's status. Shared by the todo list display and the
 * todo-change diff displays so the status→icon mapping lives in one place.
 */
export function getTodoIcon(status: TodoStatus | null) {
	switch (status) {
		case "completed":
			return <Check className="size-3 mt-1 shrink-0" />
		case "in_progress":
			return <ArrowRight className="size-3 mt-1 shrink-0" />
		default:
			return <SquareDashed className="size-3 mt-1 shrink-0" />
	}
}
