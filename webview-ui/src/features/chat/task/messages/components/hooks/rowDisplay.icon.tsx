import type React from "react"
import type { Notification, McpServerRequestData, ApiReqData, ModeConfig } from "@jabberwock/types"
import { getAllModes } from "@shared/modes"
import { safeJsonParse } from "@jabberwock/core/browser"
import { ProgressIndicator } from "../message-parts/progress-indicator"
import { TerminalSquare } from "lucide-react"

export const getIconSpan = (iconName: string, color: string): React.ReactNode => (
	<div key="icon" style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
		<span className={`codicon codicon-${iconName}`} style={{ color, fontSize: 16, marginBottom: "-1.5px" }} />
	</div>
)

export const getApiReqIcon = (
	apiReqCancelReason: string | undefined,
	cost: number | undefined,
	apiRequestFailedMessage: string | undefined,
	isLast: boolean,
	cancelledColor: string,
	errorColor: string,
	normalColor: string,
): React.ReactNode => {
	if (apiReqCancelReason !== null && apiReqCancelReason !== undefined)
		return getIconSpan("error", apiReqCancelReason === "user_cancelled" ? cancelledColor : errorColor)
	if (cost !== null && cost !== undefined) return getIconSpan("arrow-swap", normalColor)
	if (apiRequestFailedMessage) return getIconSpan("error", errorColor)
	return isLast ? <ProgressIndicator key="icon" /> : getIconSpan("arrow-swap", normalColor)
}

export const getApiReqTitle = (
	apiReqCancelReason: string | undefined,
	cost: number | undefined,
	apiRequestFailedMessage: string | undefined,
	t: (key: string) => string,
	normalColor: string,
	errorColor: string,
): React.ReactNode => {
	if (apiReqCancelReason !== null && apiReqCancelReason !== undefined)
		return (
			<span
				key="title"
				style={{
					color: apiReqCancelReason === "user_cancelled" ? normalColor : errorColor,
					fontWeight: "bold",
				}}>
				{t(
					apiReqCancelReason === "user_cancelled"
						? "chat:apiRequest.cancelled"
						: "chat:apiRequest.streamingFailed",
				)}
			</span>
		)
	if (cost !== null && cost !== undefined)
		return (
			<span key="title" style={{ color: normalColor }}>
				{t("chat:apiRequest.title")}
			</span>
		)
	if (apiRequestFailedMessage)
		return (
			<span key="title" style={{ color: errorColor }}>
				{t("chat:apiRequest.failed")}
			</span>
		)
	return (
		<span key="title" style={{ color: normalColor }}>
			{t("chat:apiRequest.streaming")}
		</span>
	)
}

export const computeIconTitleCommand = (
	isCommandExecuting: boolean,
	normalColor: string,
	t: (key: string) => string,
): [React.ReactNode, React.ReactNode] => [
	isCommandExecuting ? (
		<ProgressIndicator key="icon" />
	) : (
		<TerminalSquare key="icon" className="size-4" aria-label="Terminal icon" />
	),
	<span key="title" style={{ color: normalColor, fontWeight: "bold" }}>
		{t("chat:commandExecution.running")}
	</span>,
]

export const computeIconTitleUseMcpServer = (
	message: Notification,
	isMcpServerResponding: boolean,
	normalColor: string,
	customModes: ModeConfig[],
	t: (key: string, options?: Record<string, unknown>) => string,
): [React.ReactNode, React.ReactNode] => {
	const mcpServerUse = safeJsonParse<McpServerRequestData>(message.text)
	if (mcpServerUse === undefined) return [null, null]
	const agentName = getAllModes(customModes).find((m) => m.slug === message.mode)?.name || "Jabberwock"
	return [
		isMcpServerResponding ? (
			<ProgressIndicator key="icon" />
		) : (
			<span
				key="icon"
				className="codicon codicon-server"
				style={{ color: normalColor, marginBottom: "-1.5px" }}
			/>
		),
		<span key="title" style={{ color: normalColor, fontWeight: "bold" }}>
			{mcpServerUse.type === "use_mcp_tool"
				? t("chat:mcp.wantsToUseTool", { serverName: mcpServerUse.serverName, agentName })
				: t("chat:mcp.wantsToAccessResource", { serverName: mcpServerUse.serverName, agentName })}
		</span>,
	]
}

export const extractApiReqInfo = (
	message: Notification,
): [number | undefined, string | undefined, string | undefined] =>
	message.text !== null && message.text !== undefined && message.say === "api_req_started"
		? (() => {
				const info = safeJsonParse<ApiReqData>(message.text)
				return [info?.cost, info?.cancelReason, info?.streamingFailedMessage]
			})()
		: [undefined, undefined, undefined]
