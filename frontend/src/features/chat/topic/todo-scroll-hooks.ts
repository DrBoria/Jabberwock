import { useMemo, useEffect } from "react"

export interface TodoItem {
	id?: string
	content?: string
	status?: string
	taskId?: string
	assignedTo?: string
}

export const isInProgress = (todo: TodoItem) => todo.status === "in_progress"
export const isCompleted = (todo: TodoItem) => todo.status === "completed"

export function useScrollIndex(todos: TodoItem[]) {
	return useMemo(() => {
		const inProgressIdx = todos.findIndex(isInProgress)
		if (inProgressIdx !== -1) return inProgressIdx
		return todos.findIndex((todo) => !isCompleted(todo))
	}, [todos])
}

/** The most important todo item (in-progress, else first non-completed). */
export function useMostImportantTodo(todos: TodoItem[], scrollIndex: number): TodoItem | undefined {
	return useMemo(() => (scrollIndex >= 0 ? todos[scrollIndex] : undefined), [todos, scrollIndex])
}

interface ScrollToActiveProps {
	isCollapsed: boolean
	scrollIndex: number
	ulRef: React.RefObject<HTMLUListElement>
	itemRefs: React.MutableRefObject<(HTMLLIElement | null)[]>
}

export function useScrollToActive({ isCollapsed, scrollIndex, ulRef, itemRefs }: ScrollToActiveProps) {
	useEffect(() => {
		if (isCollapsed || !ulRef.current || scrollIndex === -1) return
		const target = itemRefs.current[scrollIndex]
		if (target && ulRef.current) {
			const ul = ulRef.current
			const targetTop = target.offsetTop - ul.offsetTop
			const targetHeight = target.offsetHeight
			const ulHeight = ul.clientHeight
			ul.scrollTop = targetTop - (ulHeight / 2 - targetHeight / 2)
		}
	}, [isCollapsed, scrollIndex, ulRef, itemRefs])
}
