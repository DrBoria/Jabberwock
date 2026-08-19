import React, { useState } from "react"
import type { DiagnosticSnapshot } from "@jabberwock/types"
import "./diagnostic-dashboard.css"
import { DashboardHeader } from "./dashboard-header.js"
import { TabNavigation } from "./tab-content.js"
import { useDiagnosticData } from "./use-diagnostic-data.js"

interface DiagnosticDashboardProps {
	diagnostics?: DiagnosticSnapshot
	isStreaming?: boolean
	devtoolEnabled?: boolean
}

const DiagnosticDashboard = ({ diagnostics, isStreaming, devtoolEnabled = false }: DiagnosticDashboardProps) => {
	const [isCollapsed, setIsCollapsed] = useState(false)
	const [activeTab, setActiveTab] = useState<"logs" | "speed" | "resources">("logs")

	const { logs, metrics, currentAction, lastResource, memoryPercent } = useDiagnosticData(diagnostics)

	if (!devtoolEnabled) return null

	const toggleCollapse = () => setIsCollapsed((prev) => !prev)

	return (
		<div className={`diagnostic-dashboard ${isCollapsed ? "collapsed" : ""}`}>
			<DashboardHeader
				isCollapsed={isCollapsed}
				isStreaming={!!isStreaming}
				currentAction={currentAction}
				metrics={metrics}
				lastResource={lastResource}
				logs={logs}
				onToggleCollapse={toggleCollapse}
			/>
			<TabNavigation
				activeTab={activeTab}
				isCollapsed={isCollapsed}
				logs={logs}
				metrics={metrics}
				lastResource={lastResource}
				memoryPercent={memoryPercent}
				onTabChange={setActiveTab}
			/>
		</div>
	)
}

export default DiagnosticDashboard
