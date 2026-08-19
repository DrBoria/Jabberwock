import { useState } from "react"
import type { McpServer } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import { ServerRowHeader } from "./ServerRowHeader"
import { ServerExpandedBody } from "./ServerExpandedBody"
import { DeleteServerDialog } from "./DeleteServerDialog"
import { ServerErrorSection } from "./mcp-server-settings"

export const ServerRow = ({ server, alwaysAllowMcp }: { server: McpServer; alwaysAllowMcp?: boolean }) => {
	const [isExpanded, setIsExpanded] = useState(false)
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
	const [timeoutValue, setTimeoutValue] = useState(() => JSON.parse(server.config)?.timeout ?? 60)
	const isExpandable = server.status === "connected" && !server.disabled
	return (
		<div style={{ marginBottom: "10px" }}>
			<ServerRowHeader
				server={server}
				isExpandable={isExpandable}
				isExpanded={isExpanded}
				onRowClick={() => isExpandable && setIsExpanded(!isExpanded)}
				onDelete={() => setShowDeleteConfirm(true)}
				onRestart={() => rootStore.settings.restartMcpServer(server.name, server.source || "global")}
			/>
			{isExpandable ? (
				isExpanded && (
					<ServerExpandedBody
						server={server}
						alwaysAllowMcp={alwaysAllowMcp}
						timeoutValue={timeoutValue}
						onTimeoutChange={(e) => {
							const v = parseInt(e.target.value)
							setTimeoutValue(v)
							rootStore.settings.updateMcpTimeout(server.name, server.source || "global", v)
						}}
					/>
				)
			) : (
				<ServerErrorSection
					server={server}
					onRestart={() => rootStore.settings.restartMcpServer(server.name, server.source || "global")}
				/>
			)}
			<DeleteServerDialog
				open={showDeleteConfirm}
				serverName={server.name}
				onOpenChange={setShowDeleteConfirm}
				onDelete={() => {
					rootStore.settings.deleteMcpServer(server.name, server.source || "global")
					setShowDeleteConfirm(false)
				}}
			/>
		</div>
	)
}
