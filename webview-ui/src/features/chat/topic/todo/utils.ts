import type React from "react"

export interface TodoItem {
	id?: string
	content: string
	status?: "completed" | "in_progress" | string
}

export const STATUS_OPTIONS = [
	{ value: "", label: "Not Started", color: "var(--vscode-foreground)", border: "#bbb", bg: "transparent" },
	{
		value: "in_progress",
		label: "In Progress",
		color: "var(--vscode-charts-yellow)",
		border: "var(--vscode-charts-yellow)",
		bg: "rgba(255, 221, 51, 0.15)",
	},
	{
		value: "completed",
		label: "Completed",
		color: "var(--vscode-charts-green)",
		border: "var(--vscode-charts-green)",
		bg: "var(--vscode-charts-green)",
	},
]

export const genId = (): string => {
	const id = Math.random().toString(36).slice(2, 10)
	return id
}

export const getTodoDotStyle = (status: string | undefined): React.CSSProperties => {
	const dot: React.CSSProperties = {
		display: "inline-block",
		width: 8,
		height: 8,
		borderRadius: "50%",
		marginRight: 6,
		marginTop: 7,
		flexShrink: 0,
	}
	return status === "completed"
		? { ...dot, background: "var(--vscode-charts-green)" }
		: status === "in_progress"
			? { ...dot, background: "var(--vscode-charts-yellow)" }
			: { ...dot, border: "1px solid var(--vscode-descriptionForeground)", background: "transparent" }
}

export const getStatusColor = (status: string | undefined): string =>
	status === "completed"
		? "var(--vscode-charts-green)"
		: status === "in_progress"
			? "var(--vscode-charts-yellow)"
			: "var(--vscode-foreground)"
