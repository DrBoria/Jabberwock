import React from "react"
import type { DiagnosticSnapshot } from "@jabberwock/types"
import { IconTerminal, IconZap, IconDatabase, IconCpu } from "./icons.js"

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B"
	const k = 1024
	const sizes = ["B", "KB", "MB", "GB"]
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export function LogsTabContent({ logs }: { logs: DiagnosticSnapshot["logs"] }) {
	return (
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
	)
}

export function SpeedTabContent({ metrics }: { metrics: DiagnosticSnapshot["metrics"] }) {
	return (
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
	)
}

export function ResourcesTabContent({
	lastResource,
	memoryPercent,
}: {
	lastResource: DiagnosticSnapshot["resources"][number] | undefined
	memoryPercent: number
}) {
	return (
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
					<span>{lastResource ? formatBytes(lastResource.memoryUsage.heapUsed) : "0 B"}</span>
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
	)
}

export function TabNavigation({
	activeTab,
	isCollapsed,
	logs,
	metrics,
	lastResource,
	memoryPercent,
	onTabChange,
}: {
	activeTab: "logs" | "speed" | "resources"
	isCollapsed: boolean
	logs: DiagnosticSnapshot["logs"]
	metrics: DiagnosticSnapshot["metrics"]
	lastResource: DiagnosticSnapshot["resources"][number] | undefined
	memoryPercent: number
	onTabChange: (tab: "logs" | "speed" | "resources") => void
}) {
	if (isCollapsed) return null
	return (
		<div className="diagnostic-tab-container">
			<div className="diagnostic-tabs">
				<button
					className={`diagnostic-tab-btn ${activeTab === "logs" ? "active" : ""}`}
					onClick={() => onTabChange("logs")}>
					<IconTerminal size={14} /> Logs
				</button>
				<button
					className={`diagnostic-tab-btn ${activeTab === "speed" ? "active" : ""}`}
					onClick={() => onTabChange("speed")}>
					<IconZap size={14} /> Speed
				</button>
				<button
					className={`diagnostic-tab-btn ${activeTab === "resources" ? "active" : ""}`}
					onClick={() => onTabChange("resources")}>
					<IconDatabase size={14} /> Resources
				</button>
			</div>
			<div className="diagnostic-tab-content">
				{activeTab === "logs" && <LogsTabContent logs={logs} />}
				{activeTab === "speed" && <SpeedTabContent metrics={metrics} />}
				{activeTab === "resources" && (
					<ResourcesTabContent lastResource={lastResource} memoryPercent={memoryPercent} />
				)}
			</div>
		</div>
	)
}
