import { cn } from "@/lib/utils"
import { t } from "i18next"
import { ArrowRight, Check, ListChecks, SquareDashed } from "lucide-react"
import { useState, useRef, useMemo, useEffect } from "react"

type TodoStatus = "completed" | "in_progress" | "pending"

function getTodoIcon(status: TodoStatus | null) {
	switch (status) {
		case "completed":
			return <Check className={`size-3 mt-1 shrink-0`} />
		case "in_progress":
			return <ArrowRight className="size-3 mt-1 shrink-0" />
		default:
			return <SquareDashed className="size-3 mt-1 shrink-0" />
	}
}

export function TodoListDisplay({ todos, onTodoClick }: { todos: any[]; onTodoClick?: (taskId: string) => void }) {
	const [isCollapsed, setIsCollapsed] = useState(true)
	const ulRef = useRef<HTMLUListElement>(null)
	const itemRefs = useRef<(HTMLLIElement | null)[]>([])
	const scrollIndex = useMemo(() => {
		const inProgressIdx = todos.findIndex((todo: any) => todo.status === "in_progress")
		if (inProgressIdx !== -1) return inProgressIdx
		return todos.findIndex((todo: any) => todo.status !== "completed")
	}, [todos])

	// Find the most important todo to display when collapsed
	const mostImportantTodo = useMemo(() => {
		const inProgress = todos.find((todo: any) => todo.status === "in_progress")
		if (inProgress) return inProgress
		return todos.find((todo: any) => todo.status !== "completed")
	}, [todos])
	useEffect(() => {
		if (isCollapsed) return
		if (!ulRef.current) return
		if (scrollIndex === -1) return
		const target = itemRefs.current[scrollIndex]
		if (target && ulRef.current) {
			const ul = ulRef.current
			const targetTop = target.offsetTop - ul.offsetTop
			const targetHeight = target.offsetHeight
			const ulHeight = ul.clientHeight
			const scrollTo = targetTop - (ulHeight / 2 - targetHeight / 2)
			ul.scrollTop = scrollTo
		}
	}, [todos, isCollapsed, scrollIndex])
	if (!Array.isArray(todos) || todos.length === 0) return null

	const totalCount = todos.length
	const completedCount = todos.filter((todo: any) => todo.status === "completed").length

	const allCompleted = completedCount === totalCount && totalCount > 0

	return (
		<div
			data-todo-list
			className="mt-1 -mx-2.5 border-t border-vscode-sideBar-background overflow-hidden animate-in fade-in duration-300">
			<div
				className={cn(
					"flex items-center gap-2 pt-2 px-2.5 cursor-pointer select-none group/title hover:bg-vscode-sideBar-background/30 transition-colors",
					mostImportantTodo?.status === "in_progress" && isCollapsed
						? "text-vscode-charts-yellow"
						: "text-vscode-foreground",
				)}
				onClick={() => setIsCollapsed((v) => !v)}>
				<ListChecks className="size-3 shrink-0 group-hover/title:scale-110 transition-transform" />
				<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-medium uppercase tracking-tight opacity-80">
					{isCollapsed
						? allCompleted
							? t("chat:todo.complete", { total: completedCount })
							: mostImportantTodo?.content // show current todo while not done
						: t("chat:todo.partial", { completed: completedCount, total: totalCount })}
				</span>
				{isCollapsed && completedCount < totalCount && (
					<div className="shrink-0 text-vscode-descriptionForeground text-[10px] font-mono">
						{completedCount}/{totalCount}
					</div>
				)}
			</div>
			{/* Inline expanded list */}
			{!isCollapsed && (
				<ul
					ref={ulRef}
					className="list-none max-h-[300px] overflow-y-auto mt-2 -mb-1 pb-2 px-2 cursor-default flex flex-col gap-1.5 scrollable">
					{todos.map((todo: any, idx: number) => {
						const icon = getTodoIcon(todo.status as TodoStatus)
						const isClickable = !!todo.taskId && onTodoClick

						return (
							<li
								key={todo.id || todo.content}
								ref={(el) => (itemRefs.current[idx] = el)}
								onClick={() => isClickable && onTodoClick!(todo.taskId)}
								className={cn(
									"group/item relative font-light flex flex-row gap-2.5 items-start p-1.5 rounded-md transition-all duration-200",
									todo.status === "in_progress" &&
										"text-vscode-charts-yellow bg-vscode-charts-yellow/5",
									todo.status !== "in_progress" && todo.status !== "completed" && "opacity-70",
									isClickable &&
										"cursor-pointer hover:bg-vscode-button-secondaryBackground/40 hover:opacity-100 ring-1 ring-transparent hover:ring-vscode-button-secondaryBackground/50",
								)}>
								<div
									className={cn(
										"mt-0.5 transition-transform duration-200",
										isClickable && "group-hover/item:scale-125",
									)}>
									{icon}
								</div>
								<div className="flex flex-col gap-0.5">
									<span className="text-[13px] leading-tight grow break-words">{todo.content}</span>
									{todo.assignedTo && (
										<span className="text-[9px] font-bold uppercase tracking-wider opacity-40">
											Assigned to: {todo.assignedTo}
										</span>
									)}
								</div>
								{isClickable && (
									<div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 transition-opacity">
										<ArrowRight size={10} className="text-vscode-descriptionForeground" />
									</div>
								)}
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)
}
