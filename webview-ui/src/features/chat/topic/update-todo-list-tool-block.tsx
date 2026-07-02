import React, { useState, useEffect, useRef } from "react"
import { ToolUseBlock, ToolUseBlockHeader } from "@src/features/foundation/components/code/ToolUseBlock"
import MarkdownBlock from "@src/features/foundation/components/markdown/MarkdownBlock"
import { genId } from "./todo/utils"
import type { TodoItem } from "./todo/utils"
import { DeleteConfirmDialog, EditToggleButton } from "./todo/actions"
import { TodoItemRow, AddTodoInput, AddTodoButton } from "./todo/rows"

interface UpdateTodoListToolBlockProps {
	todos?: TodoItem[]
	content?: string
	onChange: (todos: TodoItem[]) => void
	editable?: boolean
	userEdited?: boolean
}

const UpdateTodoListToolBlock: React.FC<UpdateTodoListToolBlockProps> = ({
	todos = [],
	content,
	onChange,
	editable = true,
	userEdited = false,
}) => {
	const [editTodos, setEditTodos] = useState<TodoItem[]>(
		todos.length > 0 ? todos.map((todo) => ({ ...todo, id: todo.id || genId() })) : [],
	)
	const [adding, setAdding] = useState(false)
	const [newContent, setNewContent] = useState("")
	const newInputRef = useRef<HTMLInputElement>(null)
	const [deleteId, setDeleteId] = useState<string | null>(null)
	const [isEditing, setIsEditing] = useState(false)
	const onChangeRef = useRef(onChange)
	onChangeRef.current = onChange

	useEffect(() => {
		if (!editable && isEditing) setIsEditing(false)
	}, [editable, isEditing])
	useEffect(() => {
		if (typeof onChangeRef.current !== "function")
			console.warn(
				"[jabberwock] UpdateTodoListToolBlock: onChange callback not passed, cannot notify model after todo changes!",
			)
	}, [])
	useEffect(() => {
		setEditTodos(todos.length > 0 ? todos.map((todo) => ({ ...todo, id: todo.id || genId() })) : [])
	}, [todos])
	useEffect(() => {
		if (adding && newInputRef.current) newInputRef.current.focus()
	}, [adding])

	const handleContentChange = (id: string, value: string) => {
		const n = editTodos.map((t) => (t.id === id ? { ...t, content: value } : t))
		setEditTodos(n)
		onChange?.(n)
	}
	const handleStatusChange = (id: string, status: string) => {
		const n = editTodos.map((t) => (t.id === id ? { ...t, status } : t))
		setEditTodos(n)
		onChange?.(n)
	}
	const handleDelete = (id: string) => setDeleteId(id)
	const confirmDelete = () => {
		if (!deleteId) return
		const n = editTodos.filter((t) => t.id !== deleteId)
		setEditTodos(n)
		onChange?.(n)
		setDeleteId(null)
	}
	const cancelDelete = () => setDeleteId(null)
	const handleAdd = () => {
		if (!newContent.trim()) return
		const t = { id: genId(), content: newContent.trim(), status: "" }
		const n = [...editTodos, t]
		setEditTodos(n)
		onChange?.(n)
		setNewContent("")
		setAdding(false)
	}
	const handleNewInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") handleAdd()
		else if (e.key === "Escape") {
			setAdding(false)
			setNewContent("")
		}
	}

	if (userEdited)
		return (
			<ToolUseBlock>
				<ToolUseBlockHeader>
					<div className="flex items-center w-full" style={{ width: "100%" }}>
						<span
							className="codicon codicon-feedback mr-1.5"
							style={{ color: "var(--vscode-charts-yellow)" }}
						/>
						<span className="font-bold mr-2" style={{ fontWeight: "bold" }}>
							User Edit
						</span>
						<div className="flex-grow" />
					</div>
				</ToolUseBlockHeader>
				<div className="overflow-x-auto max-w-full" style={{ padding: "12px 0 8px 0" }}>
					<span className="text-vscode-descriptionForeground">User Edits</span>
				</div>
			</ToolUseBlock>
		)

	return (
		<ToolUseBlock>
			<ToolUseBlockHeader>
				<div className="flex items-center w-full" style={{ width: "100%" }}>
					<span className="codicon codicon-checklist mr-1.5" style={{ color: "var(--vscode-foreground)" }} />
					<span className="font-bold mr-2" style={{ fontWeight: "bold" }}>
						Todo List Updated
					</span>
					<div className="flex-grow" />
					{editable && <EditToggleButton isEditing={isEditing} onToggle={() => setIsEditing((v) => !v)} />}
				</div>
			</ToolUseBlockHeader>
			<div className="overflow-x-auto max-w-full" style={{ padding: "6px 0 2px 0" }}>
				{Array.isArray(editTodos) && editTodos.length > 0 ? (
					<ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
						{editTodos.map((todo, idx) => (
							<TodoItemRow
								key={todo.id || idx}
								todo={todo}
								isEditing={isEditing}
								onContentChange={handleContentChange}
								onStatusChange={handleStatusChange}
								onDelete={handleDelete}
							/>
						))}
						<AddTodoInput
							adding={adding}
							newContent={newContent}
							onNewContentChange={setNewContent}
							onAdd={handleAdd}
							onCancel={() => {
								setAdding(false)
								setNewContent("")
							}}
							onKeyDown={handleNewInputKeyDown}
							newInputRef={newInputRef}
						/>
						<AddTodoButton isEditing={isEditing && !adding} onAdd={() => setAdding(true)} />
					</ul>
				) : (
					<MarkdownBlock markdown={content} />
				)}
			</div>
			<DeleteConfirmDialog deleteId={deleteId} onConfirm={confirmDelete} onCancel={cancelDelete} />
		</ToolUseBlock>
	)
}

export default UpdateTodoListToolBlock
