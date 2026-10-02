import React from "react"
import type { ModeConfig, Notification, McpServerRequestData } from "@jabberwock/types"
import { safeJsonParse } from "@jabberwock/core/browser"
import { getAllModes } from "@shared/modes"
import { Lightbulb, MessageCircleQuestionMark, TerminalSquare } from "lucide-react"
import { ProgressIndicator } from "@src/features/chat/task/messages/components/message-parts/progress-indicator"

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
	<span key="label" style={{ color: normalColor, fontWeight: "bold" }}>
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
		<span key="label" style={{ color: normalColor, fontWeight: "bold" }}>
			{mcpServerUse.type === "use_mcp_tool"
				? t("chat:mcp.wantsToUseTool", { serverName: mcpServerUse.serverName, agentName })
				: t("chat:mcp.wantsToAccessResource", { serverName: mcpServerUse.serverName, agentName })}
		</span>,
	]
}

const getIconSpan = (iconName: string, color: string) => (
	<div key="icon" style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
		<span className={`codicon codicon-${iconName}`} style={{ color, fontSize: 16, marginBottom: "-1.5px" }} />
	</div>
)

const getApiReqIcon = (
	apiReqCancelReason: string | undefined,
	cost: number | undefined,
	apiRequestFailedMessage: string | undefined,
	isLast: boolean,
	cancelledColor: string,
	errorColor: string,
	normalColor: string,
) => {
	if (apiReqCancelReason !== null && apiReqCancelReason !== undefined)
		return getIconSpan("error", apiReqCancelReason === "user_cancelled" ? cancelledColor : errorColor)
	if (cost !== null && cost !== undefined) return getIconSpan("arrow-swap", normalColor)
	if (apiRequestFailedMessage) return getIconSpan("error", errorColor)
	return isLast ? <ProgressIndicator key="icon" /> : getIconSpan("arrow-swap", normalColor)
}

// While the request is in-flight but no token has arrived yet (prefill /
// prompt processing), the model is loading context, not thinking. Show a
// distinct label so the prefill phase is not confused with "Thinking". When
// the provider reports a real prefill percentage (llama.cpp), show it.
const PREFILL_BAR_BG = "var(--vscode-progressBar-background, #0078d4)"

const getPrefillTitle = (
	t: (key: string, options?: Record<string, unknown>) => string,
	normalColor: string,
	prefillPercent: number | null,
) => {
	const label =
		prefillPercent !== null
			? t("chat:apiRequest.loadingContextPercent", { percent: prefillPercent })
			: t("chat:apiRequest.loadingContext")
	if (prefillPercent === null) {
		return (
			<span key="title" style={{ color: normalColor }}>
				{label}
			</span>
		)
	}
	return (
		<span key="title" style={{ display: "inline-flex", flexDirection: "column", gap: "2px" }}>
			<span style={{ color: normalColor }}>{label}</span>
			<span
				style={{
					width: "140px",
					height: "3px",
					borderRadius: "2px",
					background: PREFILL_BAR_BG,
					opacity: 0.25,
					overflow: "hidden",
					position: "relative",
				}}>
				<span
					style={{
						position: "absolute",
						inset: 0,
						width: `${Math.max(0, Math.min(100, prefillPercent))}%`,
						background: PREFILL_BAR_BG,
						opacity: 1,
						transition: "width 0.3s ease",
					}}
				/>
			</span>
		</span>
	)
}

const getApiReqTitle = (
	apiReqCancelReason: string | undefined,
	cost: number | undefined,
	apiRequestFailedMessage: string | undefined,
	t: (key: string, options?: Record<string, unknown>) => string,
	normalColor: string,
	errorColor: string,
	isPrefilling: boolean,
	prefillPercent: number | null,
) => {
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
	if (isPrefilling) return getPrefillTitle(t, normalColor, prefillPercent)
	return (
		<span key="title" style={{ color: normalColor }}>
			{t("chat:apiRequest.streaming")}
		</span>
	)
}

const computeFollowupOrReasoningIconTitle = (
	type: string,
	normalColor: string,
	t: (key: string) => string,
): [React.ReactNode, React.ReactNode] =>
	type === "followup"
		? [
				<MessageCircleQuestionMark key="icon" className="w-4 shrink-0" aria-label="Question icon" />,
				<span key="label" style={{ color: normalColor, fontWeight: "bold" }}>
					{t("chat:questions.hasQuestion")}
				</span>,
			]
		: [
				<Lightbulb key="icon" className="w-4 shrink-0" aria-label="Lightbulb icon" />,
				<span key="label" style={{ color: normalColor, fontWeight: "bold" }}>
					{t("chat:reasoning.thinking")}
				</span>,
			]

const computeCompletionResultIconTitle = (
	successColor: string,
	t: (key: string, options?: Record<string, unknown>) => string,
): [React.ReactNode, React.ReactNode] => [
	<span key="icon" className="codicon codicon-check" style={{ color: successColor, marginBottom: "-1.5px" }} />,
	<span key="label" style={{ color: successColor, fontWeight: "bold" }}>
		{t("chat:taskCompleted")}
	</span>,
]

const computeApiReqStartedIconTitle = (
	apiReqCancelReason: string | undefined,
	cost: number | undefined,
	apiRequestFailedMessage: string | undefined,
	isLast: boolean,
	cancelledColor: string,
	errorColor: string,
	normalColor: string,
	t: (key: string, options?: Record<string, unknown>) => string,
	isPrefilling: boolean,
	prefillPercent: number | null,
): [React.ReactNode, React.ReactNode] => [
	getApiReqIcon(apiReqCancelReason, cost, apiRequestFailedMessage, isLast, cancelledColor, errorColor, normalColor),
	getApiReqTitle(
		apiReqCancelReason,
		cost,
		apiRequestFailedMessage,
		t,
		normalColor,
		errorColor,
		isPrefilling,
		prefillPercent,
	),
]

export const computeIconTitle = (
	type: string,
	isCommandExecuting: boolean,
	message: Notification,
	isMcpServerResponding: boolean,
	normalColor: string,
	t: (key: string, options?: Record<string, unknown>) => string,
	successColor: string,
	apiReqCancelReason: string | undefined,
	cost: number | undefined,
	apiRequestFailedMessage: string | undefined,
	isLast: boolean,
	cancelledColor: string,
	errorColor: string,
	customModes: ModeConfig[],
	isPrefilling: boolean,
	prefillPercent: number | null,
): [React.ReactNode, React.ReactNode] => {
	const nullTypes = new Set(["error", "mistake_limit_reached", "api_req_rate_limit_wait", "api_req_retry_delayed"])
	if (nullTypes.has(type)) return [null, null]
	if (type === "command") return computeIconTitleCommand(isCommandExecuting, normalColor, t)
	if (type === "use_mcp_server")
		return computeIconTitleUseMcpServer(message, isMcpServerResponding, normalColor, customModes, t)
	if (type === "followup" || type === "reasoning") return computeFollowupOrReasoningIconTitle(type, normalColor, t)
	if (type === "completion_result") return computeCompletionResultIconTitle(successColor, t)
	if (type === "api_req_started")
		return computeApiReqStartedIconTitle(
			apiReqCancelReason,
			cost,
			apiRequestFailedMessage,
			isLast,
			cancelledColor,
			errorColor,
			normalColor,
			t,
			isPrefilling,
			prefillPercent,
		)
	return [null, null]
}
