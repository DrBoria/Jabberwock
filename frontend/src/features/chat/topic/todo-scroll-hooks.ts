import { useMemo, useEffect } from "react"

export interface TodoItem {
	id?: string
	content?: string
	status?: string
	taskId?: string
	assignedTo?: string
}

export function useScrollIndex(todos: TodoItem[]) {
	return useMemo(() => {
		const inProgressIdx = todos.findIndex((todo) => todo.status === "in_progress")
		if (inProgressIdx !== -1) return inProgressIdx
		return todos.findIndex((todo) => todo.status !== "completed")
	}, [todos])
}

export function useMostImportantTodo(todos: TodoItem[]) {
	return useMemo(() => {
		const inProgress = todos.find((todo) => todo.status === "in_progress")
		if (inProgress) return inProgress
		return todos.find((todo) => todo.status !== "completed")
	}, [todos])
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
