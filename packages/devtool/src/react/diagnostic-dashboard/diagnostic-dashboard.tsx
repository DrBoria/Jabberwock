import React, { useState, useMemo } from "react"
import type { DiagnosticSnapshot } from "@jabberwock/types"
import { vscode } from "@jabberwock/devtool/react"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import "./diagnostic-dashboard.css"

interface DiagnosticDashboardProps {
	diagnostics?: DiagnosticSnapshot
	isStreaming?: boolean
}

// Simple SVG icon components (no external deps)
const IconActivity = ({ size, color }: { size: number; color: string }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round">
		<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
	</svg>
)

const IconChevronDown = ({ size }: { size: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round">
		<polyline points="6 9 12 15 18 9" />
	</svg>
)

const IconChevronUp = ({ size }: { size: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round">
		<polyline points="18 15 12 9 6 15" />
	</svg>
)

const IconTrash = ({ size }: { size: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round">
		<polyline points="3 6 5 6 21 6" />
		<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
	</svg>
)

const IconShare = ({ size }: { size: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round">
		<circle cx="18" cy="5" r="3" />
		<circle cx="6" cy="12" r="3" />
		<circle cx="18" cy="19" r="3" />
		<line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
		<line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
	</svg>
)

const IconTerminal = ({ size }: { size: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round">
		<polyline points="4 17 10 11 4 5" />
		<line x1="12" y1="19" x2="20" y2="19" />
	</svg>
)

const IconZap = ({ size }: { size: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round">
		<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
	</svg>
)

const IconDatabase = ({ size }: { size: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round">
		<ellipse cx="12" cy="5" rx="9" ry="3" />
		<path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
		<path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
	</svg>
)

const IconCpu = ({ size }: { size: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round">
		<rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
		<rect x="9" y="9" width="6" height="6" />
		<line x1="9" y1="1" x2="9" y2="4" />
		<line x1="15" y1="1" x2="15" y2="4" />
		<line x1="9" y1="20" x2="9" y2="23" />
		<line x1="15" y1="20" x2="15" y2="23" />
		<line x1="20" y1="9" x2="23" y2="9" />
		<line x1="20" y1="14" x2="23" y2="14" />
		<line x1="1" y1="9" x2="4" y2="9" />
		<line x1="1" y1="14" x2="4" y2="14" />
	</svg>
)

const DiagnosticDashboard = ({ diagnostics, isStreaming }: DiagnosticDashboardProps) => {
	const { devtoolEnabled } = useExtensionState()
	const [isCollapsed, setIsCollapsed] = useState(false)
	const [activeTab, setActiveTab] = useState<"logs" | "speed" | "resources">("logs")

	const logs = diagnostics?.logs || []
	const metrics = diagnostics?.metrics || []
	const resources = diagnostics?.resources || []
	const currentAction = diagnostics?.currentAction

	const lastResource = resources[resources.length - 1]

	const memoryPercent = useMemo(() => {
		if (!lastResource) return 0
		return (lastResource.memoryUsage.heapUsed / lastResource.memoryUsage.heapTotal) * 100
	}, [lastResource])

	if (!devtoolEnabled) {
		return null
	}

	const formatBytes = (bytes: number) => {
		if (bytes === 0) return "0 B"
		const k = 1024
		const sizes = ["B", "KB", "MB", "GB"]
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
	}

	const handleExport = () => {
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

		vscode.postMessage({
			type: "insertTextIntoTextarea",
			text: markdown,
		})
	}

	const handleClear = () => {
		vscode.postMessage({
			type: "clearDiagnostics",
		})
	}

	return (
		<div className={`diagnostic-dashboard ${isCollapsed ? "collapsed" : ""}`}>
			<div className="diagnostic-dashboard-header">
				<div className="diagnostic-dashboard-title" onClick={() => setIsCollapsed(!isCollapsed)}>
					<IconActivity size={16} color={isStreaming ? "#4facfe" : "rgba(255,255,255,0.4)"} />
					<span>Diagnostics</span>
					{currentAction && !isCollapsed && <span className="action-badge">{currentAction}</span>}
				</div>
				<div className="diagnostic-header-actions">
					{!isCollapsed && (
						<>
							<button className="icon-button" onClick={handleClear} title="Clear diagnostics">
								<IconTrash size={14} />
							</button>
							<button className="icon-button" onClick={handleExport} title="Export to chat">
								<IconShare size={14} />
							</button>
						</>
					)}
					<div onClick={() => setIsCollapsed(!isCollapsed)} style={{ display: "flex", cursor: "pointer" }}>
						{isCollapsed ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />}
					</div>
				</div>
			</div>

			{!isCollapsed && (
				<div className="diagnostic-tab-container">
					<div className="diagnostic-tabs">
						<button
							className={`diagnostic-tab-btn ${activeTab === "logs" ? "active" : ""}`}
							onClick={() => setActiveTab("logs")}>
							<IconTerminal size={14} /> Logs
						</button>
						<button
							className={`diagnostic-tab-btn ${activeTab === "speed" ? "active" : ""}`}
							onClick={() => setActiveTab("speed")}>
							<IconZap size={14} /> Speed
						</button>
						<button
							className={`diagnostic-tab-btn ${activeTab === "resources" ? "active" : ""}`}
							onClick={() => setActiveTab("resources")}>
							<IconDatabase size={14} /> Resources
						</button>
					</div>

					<div className="diagnostic-tab-content">
						{activeTab === "logs" && (
							<div className="logs-view">
								{logs.map((log, i) => (
									<div key={i} className={`diagnostic-log-item log-${log.level}`}>
										<span className="diagnostic-log-time">
											{new Date(log.timestamp).toLocaleTimeString([], {
												hour12: false,
												hour: "2-digit",
												minute: "2-digit",
												second: "2-digit",
											})}
										</span>
										<span className="diagnostic-log-message">{log.message}</span>
									</div>
								))}
								{logs.length === 0 && <div className="empty-state">No logs yet...</div>}
							</div>
						)}

						{activeTab === "speed" && (
							<table className="speed-table">
								<thead>
									<tr>
										<th>Action</th>
										<th>Duration</th>
										<th>Status</th>
									</tr>
								</thead>
								<tbody>
									{metrics.map((metric) => (
										<tr key={metric.id}>
											<td>{metric.name}</td>
											<td>
												<span className="duration-tag">{metric.durationMs}ms</span>
											</td>
											<td>
												<span className={`status-dot status-${metric.status}`} />
												{metric.status}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}

						{activeTab === "resources" && (
							<div className="resources-view">
								<div className="resource-usage-item">
									<div className="resource-label">
										<span>
											<IconCpu size={12} /> CPU
										</span>
										<span>{lastResource ? lastResource.cpuUsage.toFixed(1) : 0}%</span>
									</div>
									<div className="resource-bar-bg">
										<div
											className={`resource-bar-fill ${lastResource && lastResource.cpuUsage > 70 ? "warning" : ""}`}
											style={{ width: `${lastResource ? lastResource.cpuUsage : 0}%` }}
										/>
									</div>
								</div>

								<div className="resource-usage-item">
									<div className="resource-label">
										<span>
											<IconDatabase size={12} /> Memory
										</span>
										<span>
											{lastResource ? formatBytes(lastResource.memoryUsage.heapUsed) : "0 B"}
										</span>
									</div>
									<div className="resource-bar-bg">
										<div
											className={`resource-bar-fill ${memoryPercent > 80 ? "warning" : ""}`}
											style={{ width: `${memoryPercent}%` }}
										/>
									</div>
									<div className="resource-sub-label">
										{lastResource && (
											<span>
												Total: {formatBytes(lastResource.memoryUsage.heapTotal)} | RSS:{" "}
												{formatBytes(lastResource.memoryUsage.rss)}
											</span>
										)}
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	)
}

export default DiagnosticDashboard
