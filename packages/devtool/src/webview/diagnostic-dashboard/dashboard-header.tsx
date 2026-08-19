import React from "react"
import type { DiagnosticSnapshot } from "@jabberwock/types"
import { vscode } from "../vscode.js"
import { IconActivity, IconTrash, IconShare, IconChevronDown, IconChevronUp } from "./icons.js"

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B"
	const k = 1024
	const sizes = ["B", "KB", "MB", "GB"]
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

function buildMarkdownExport(
	currentAction: string | undefined,
	metrics: DiagnosticSnapshot["metrics"],
	lastResource: DiagnosticSnapshot["resources"][number] | undefined,
	logs: DiagnosticSnapshot["logs"],
): string {
	const timestamp = new Date().toISOString()
	let markdown = `## Jabberwock Diagnostic Export (${timestamp})\n\n`

	if (currentAction) {
		markdown += `**Current Action:** ${currentAction}\n\n`
	}

	markdown += `### Performance Metrics\n`
	markdown += `| Action | Duration | Status |\n`
	markdown += `| :--- | :--- | :--- |\n`
	metrics.forEach((m) => {
		markdown += `| ${m.name} | ${m.durationMs}ms | ${m.status} |\n`
	})
	markdown += `\n`

	if (lastResource) {
		markdown += `### Resources\n`
		markdown += `- **CPU:** ${lastResource.cpuUsage.toFixed(1)}%\n`
		markdown += `- **Memory (Heap):** ${formatBytes(lastResource.memoryUsage.heapUsed)} / ${formatBytes(lastResource.memoryUsage.heapTotal)}\n`
		markdown += `- **Memory (RSS):** ${formatBytes(lastResource.memoryUsage.rss)}\n\n`
	}

	markdown += `### Recent Logs\n\`\`\`text\n`
	logs.slice(-50).forEach((log) => {
		const time = new Date(log.timestamp).toLocaleTimeString([], {
			hour12: false,
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		})
		markdown += `[${time}] ${log.message}\n`
	})
	markdown += `\`\`\``

	return markdown
}

export function DashboardHeader({
	isCollapsed,
	isStreaming,
	currentAction,
	metrics,
	lastResource,
	logs,
	onToggleCollapse,
}: {
	isCollapsed: boolean
	isStreaming: boolean
	currentAction: string | undefined
	metrics: DiagnosticSnapshot["metrics"]
	lastResource: DiagnosticSnapshot["resources"][number] | undefined
	logs: DiagnosticSnapshot["logs"]
	onToggleCollapse: () => void
}) {
	return (
		<div className="diagnostic-dashboard-header">
			<div className="diagnostic-dashboard-title" onClick={onToggleCollapse}>
				<IconActivity size={16} color={isStreaming ? "#4facfe" : "rgba(255,255,255,0.4)"} />
				<span>Diagnostics</span>
				{currentAction && !isCollapsed && <span className="action-badge">{currentAction}</span>}
			</div>
			<div className="diagnostic-header-actions">
				{!isCollapsed && (
					<>
						<button
							className="icon-button"
							onClick={() => vscode.postMessage({ type: "clearDiagnostics" })}
							title="Clear diagnostics">
							<IconTrash size={14} />
						</button>
						<button
							className="icon-button"
							onClick={() =>
								vscode.postMessage({
									type: "insertTextIntoTextarea",
									text: buildMarkdownExport(currentAction, metrics, lastResource, logs),
								})
							}
							title="Export to chat">
							<IconShare size={14} />
						</button>
					</>
				)}
				<div onClick={onToggleCollapse} style={{ display: "flex", cursor: "pointer" }}>
					{isCollapsed ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />}
				</div>
			</div>
		</div>
	)
}
