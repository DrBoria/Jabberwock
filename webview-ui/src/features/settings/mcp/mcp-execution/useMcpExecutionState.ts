import { useCallback, useEffect, useMemo, useState } from "react"
import { onSnapshot } from "mobx-state-tree"
import { useTranslation } from "react-i18next"
import type { McpExecutionStatus } from "@jabberwock/types"
import { getRootStore } from "@src/features/root-store"
import type { UseMcpExecutionStateParams } from "./types"

export const useMcpExecutionState = ({
	executionId,
	text,
	useMcpServer,
	serverName,
	toolName,
	isArguments,
}: UseMcpExecutionStateParams) => {
	const { t } = useTranslation("mcp")
	const [status, setStatus] = useState<McpExecutionStatus | null>(null)
	const [responseText, setResponseText] = useState(text || "")
	const [argumentsText, setArgumentsText] = useState(text || "")
	const [isResponseExpanded, setIsResponseExpanded] = useState(false)
	const tryParseJson = useCallback((text: string): { isJson: boolean; formatted: string } => {
		if (!text) return { isJson: false, formatted: "" }
		try {
			const parsed = JSON.parse(text)
			return { isJson: true, formatted: JSON.stringify(parsed, null, 2) }
		} catch {
			return { isJson: false, formatted: text }
		}
	}, [])
	const responseData = useMemo(() => {
		if (!isResponseExpanded) return { isJson: false, formatted: responseText }
		if (status && status.status === "completed") return tryParseJson(responseText)
		return { isJson: false, formatted: responseText }
	}, [responseText, isResponseExpanded, tryParseJson, status])
	const argumentsData = useMemo(() => {
		if (!argumentsText) return { isJson: false, formatted: "" }
		const trimmed = argumentsText.trim()
		const isCompleteJson =
			trimmed &&
			((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]")))
		if (isCompleteJson) {
			try {
				const parsed = JSON.parse(trimmed)
				return { isJson: true, formatted: JSON.stringify(parsed, null, 2) }
			} catch {
				return { isJson: false, formatted: argumentsText }
			}
		}
		return { isJson: false, formatted: argumentsText }
	}, [argumentsText])
	const onToggleResponseExpand = useCallback(() => setIsResponseExpanded(!isResponseExpanded), [isResponseExpanded])
	useEffect(() => {
		const unsubscribe = onSnapshot(getRootStore().mcpExecution, (snapshot) => {
			const execution = snapshot.executions.find(
				(e: { executionId: string; status: string; response?: string }) => e.executionId === executionId,
			)
			if (execution) {
				setStatus(execution)
				if (execution.status === "output" && execution.response)
					setResponseText((prev) => prev + execution.response)
				else if (execution.status === "completed" && execution.response) setResponseText(execution.response)
			}
		})
		return () => unsubscribe()
	}, [executionId])
	useEffect(() => {
		if (text) setArgumentsText(text)
		if (useMcpServer?.response) setResponseText(useMcpServer.response)
	}, [text, useMcpServer])
	const isUseMcpTool = useMcpServer?.type === "use_mcp_tool"
	const hasToolNameAndServer = !!toolName && !!serverName
	const hasUseMcpArgs = !!useMcpServer?.arguments
	return {
		t,
		status,
		responseText,
		argumentsText,
		serverName,
		toolName,
		isResponseExpanded,
		responseIsJson: responseData.isJson,
		formattedResponseText: responseData.formatted,
		formattedArgumentsText: argumentsData.formatted,
		isUseMcpTool,
		hasToolNameAndServer,
		isPartial: status ? status.status !== "completed" : false,
		showToolSection: !!useMcpServer || hasToolNameAndServer,
		hasArguments: isArguments || hasUseMcpArgs || !!argumentsText,
		onToggleResponseExpand,
	}
}
