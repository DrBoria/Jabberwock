import type { McpServer } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import { Button } from "@src/shared/ui/buttons/button"
import { ToggleSwitch } from "@src/shared/ui/buttons/toggle-switch"

const getStatusColor = (s: McpServer) =>
	s.disabled
		? "var(--vscode-descriptionForeground)"
		: s.status === "connected"
			? "var(--vscode-testing-iconPassed)"
			: s.status === "connecting"
				? "var(--vscode-charts-yellow)"
				: "var(--vscode-testing-iconFailed)"

interface ServerRowHeaderProps {
	server: McpServer
	isExpandable: boolean
	isExpanded: boolean
	onRowClick: () => void
	onDelete: () => void
	onRestart: () => void
}

export const ServerRowHeader = ({
	server,
	isExpandable,
	isExpanded,
	onRowClick,
	onDelete,
	onRestart,
}: ServerRowHeaderProps) => (
	<div
		style={{
			display: "flex",
			alignItems: "center",
			padding: "8px",
			background: "var(--vscode-textCodeBlock-background)",
			cursor: isExpandable ? "pointer" : "default",
			borderRadius: isExpanded || isExpandable ? "4px" : "4px 4px 0 0",
			opacity: server.disabled ? 0.6 : 1,
		}}
		onClick={onRowClick}>
		{isExpandable && (
			<span
				className={`codicon codicon-chevron-${isExpanded ? "down" : "right"}`}
				style={{ marginRight: "8px" }}
			/>
		)}
		<span style={{ flex: 1 }}>
			{server.name}
			{server.source && (
				<span
					style={{
						marginLeft: "8px",
						padding: "1px 6px",
						fontSize: "11px",
						borderRadius: "4px",
						background: "var(--vscode-badge-background)",
						color: "var(--vscode-badge-foreground)",
					}}>
					{server.source}
				</span>
			)}
		</span>
		<div style={{ display: "flex", alignItems: "center", marginRight: "8px" }} onClick={(e) => e.stopPropagation()}>
			<Button variant="ghost" size="icon" onClick={onDelete} style={{ marginRight: "8px" }}>
				<span className="codicon codicon-trash" style={{ fontSize: "14px" }} />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				onClick={onRestart}
				disabled={server.status === "connecting"}
				style={{ marginRight: "8px" }}>
				<span className="codicon codicon-refresh" style={{ fontSize: "14px" }} />
			</Button>
		</div>
		<div
			style={{
				width: "8px",
				height: "8px",
				borderRadius: "50%",
				background: getStatusColor(server),
				marginLeft: "8px",
			}}
		/>
		<div style={{ marginLeft: "8px" }}>
			<ToggleSwitch
				checked={!server.disabled}
				onChange={() =>
					rootStore.settings.toggleMcpServer(server.name, server.source || "global", !server.disabled)
				}
				size="medium"
				aria-label={`Toggle ${server.name} server`}
			/>
		</div>
	</div>
)
