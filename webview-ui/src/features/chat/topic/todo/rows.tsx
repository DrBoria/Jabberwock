import type React from "react"
import { STATUS_OPTIONS, getTodoDotStyle, getStatusColor } from "./utils"
import type { TodoItem } from "./utils"

export const TodoItemRow = ({
	todo,
	isEditing,
	onContentChange,
	onStatusChange,
	onDelete,
}: {
	todo: TodoItem
	isEditing: boolean
	onContentChange: (id: string, value: string) => void
	onStatusChange: (id: string, status: string) => void
	onDelete: (id: string) => void
}) => {
	const dotStyle = getTodoDotStyle(todo.status)
	const statusColor = getStatusColor(todo.status)
	return (
		<li style={{ marginBottom: 2, display: "flex", alignItems: "flex-start", minHeight: 20 }}>
			<span style={dotStyle} />
			{isEditing ? (
				<input
					type="text"
					value={todo.content}
					placeholder="Enter todo item"
					onChange={(e) => onContentChange(todo.id!, e.target.value)}
					style={{
						flex: 1,
						minWidth: 0,
						fontWeight: 500,
						color: "var(--vscode-input-foreground)",
						background: "var(--vscode-input-background)",
						border: "none",
						outline: "none",
						fontSize: 13,
						marginRight: 6,
						padding: "1px 3px",
						borderBottom: "1px solid var(--vscode-input-border)",
					}}
					onBlur={(e) => {
						if (!e.target.value.trim()) onDelete(todo.id!)
					}}
				/>
			) : (
				<span
					style={{
						flex: 1,
						minWidth: 0,
						fontWeight: 500,
						color: statusColor,
						fontSize: 13,
						marginRight: 6,
						padding: "1px 3px",
						lineHeight: "1.4",
					}}>
					{todo.content}
				</span>
			)}
			{isEditing && (
				<select
					value={todo.status || ""}
					onChange={(e) => onStatusChange(todo.id!, e.target.value)}
					style={{
						marginRight: 6,
						borderRadius: 4,
						border: "1px solid var(--vscode-input-border)",
						background: "var(--vscode-input-background)",
						color: "var(--vscode-input-foreground)",
						fontSize: 12,
						padding: "1px 4px",
					}}>
					{STATUS_OPTIONS.map((opt) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>
			)}
			{isEditing && (
				<button
					onClick={() => onDelete(todo.id!)}
					style={{
						border: "none",
						background: "transparent",
						color: "#f14c4c",
						cursor: "pointer",
						fontSize: 14,
						marginLeft: 2,
						padding: 0,
						lineHeight: 1,
					}}
					title="Remove">
					×
				</button>
			)}
		</li>
	)
}

export const AddTodoInput = ({
	adding,
	newContent,
	onNewContentChange,
	onAdd,
	onCancel,
	onKeyDown,
	newInputRef,
}: {
	adding: boolean
	newContent: string
	onNewContentChange: (value: string) => void
	onAdd: () => void
	onCancel: () => void
	onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
	newInputRef: React.RefObject<HTMLInputElement>
}) =>
	!adding ? null : (
		<li style={{ marginTop: 2, display: "flex", alignItems: "center" }}>
			<span style={{ width: 14, marginRight: 6 }} />
			<input
				ref={newInputRef}
				type="text"
				value={newContent}
				placeholder="Enter todo item, press Enter to add"
				onChange={(e) => onNewContentChange(e.target.value)}
				onKeyDown={onKeyDown}
				style={{
					flex: 1,
					minWidth: 0,
					fontWeight: 500,
					color: "var(--vscode-foreground)",
					background: "transparent",
					border: "none",
					outline: "none",
					fontSize: 13,
					marginRight: 6,
					padding: "1px 3px",
					borderBottom: "1px solid #eee",
				}}
			/>
			<button
				onClick={onAdd}
				disabled={!newContent.trim()}
				style={{
					border: "1px solid var(--vscode-button-border)",
					background: "var(--vscode-button-background)",
					color: "var(--vscode-button-foreground)",
					borderRadius: 4,
					padding: "1px 7px",
					cursor: newContent.trim() ? "pointer" : "not-allowed",
					fontSize: 12,
					marginRight: 4,
				}}>
				Add
			</button>
			<button
				onClick={onCancel}
				style={{
					border: "1px solid var(--vscode-button-secondaryBorder)",
					background: "var(--vscode-button-secondaryBackground)",
					color: "var(--vscode-button-secondaryForeground)",
					borderRadius: 4,
					padding: "1px 7px",
					cursor: "pointer",
					fontSize: 12,
				}}>
				Cancel
			</button>
		</li>
	)

export const AddTodoButton = ({ isEditing, onAdd }: { isEditing: boolean; onAdd: () => void }) =>
	!isEditing ? null : (
		<li style={{ marginTop: 2 }}>
			<button
				onClick={onAdd}
				style={{
					border: "1px dashed var(--vscode-button-secondaryBorder)",
					background: "var(--vscode-button-secondaryBackground)",
					color: "var(--vscode-button-secondaryForeground)",
					borderRadius: 4,
					padding: "1px 8px",
					cursor: "pointer",
					fontSize: 12,
				}}>
				+ Add Todo
			</button>
		</li>
	)
