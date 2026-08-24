import { useCallback, useEffect, useMemo, useState } from "react"
import { Server } from "lucide-react"
import { onSnapshot } from "mobx-state-tree"
import { type McpExecutionStatus, type McpServerRequestData } from "@jabberwock/types"
import { getRootStore } from "../../../../root-store"
import { Container } from "@src/shared/ui/layouts/Container"

import {
	parseArgumentsText,
	StatusHeader,
	ToolSection,
	ArgumentsBlock,
	ResponseContainer,
} from "./execution-components"

interface McpExecutionProps {
	executionId: string
	text?: string
	serverName?: string
	toolName?: string
	isArguments?: boolean
	server?: {
		tools?: Array<{ name: string; description?: string; alwaysAllow?: boolean }>
		source?: "global" | "project"
	}
	useMcpServer?: McpServerRequestData
	alwaysAllowMcp?: boolean
}

export const McpExecution = ({
	executionId,
	text,
	serverName: initialServerName,
	toolName: initialToolName,
	isArguments = false,
	server,
	useMcpServer,
	alwaysAllowMcp = false,
}: McpExecutionProps) => {
	const [status, setStatus] = useState<McpExecutionStatus | null>(null)
	const [responseText, setResponseText] = useState(text || "")
	const [argumentsText, setArgumentsText] = useState(text || "")
	const [serverName, setServerName] = useState(initialServerName)
	const [toolName, setToolName] = useState(initialToolName)
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
		if (status?.status === "completed") return tryParseJson(responseText)
		return { isJson: false, formatted: responseText }
	}, [responseText, isResponseExpanded, tryParseJson, status])

	const argumentsData = useMemo(() => parseArgumentsText(argumentsText), [argumentsText])
	const formattedResponseText = responseData.formatted
	const formattedArgumentsText = argumentsData.formatted
	const responseIsJson = responseData.isJson
	const onToggleResponseExpand = useCallback(() => setIsResponseExpanded((prev) => !prev), [])

	useEffect(() => {
		const unsubscribe = onSnapshot(getRootStore().mcpExecution, (snapshot) => {
			const execution = snapshot.executions.find((e) => e.executionId === executionId)
			if (!execution) return
			setStatus(execution)
			if (execution.status === "output" && execution.response)
				setResponseText((prev) => prev + execution.response)
			else if (execution.status === "completed" && execution.response) setResponseText(execution.response)
		})
		return () => unsubscribe()
	}, [executionId])

	useEffect(() => {
		if (text) setArgumentsText(text)
		if (useMcpServer?.response) setResponseText(useMcpServer.response)
		if (initialServerName) setServerName(initialServerName)
		if (initialToolName) setToolName(initialToolName)
	}, [text, useMcpServer, initialServerName, initialToolName])

	return (
		<>
			<Container $preset="toolbar" $gap="8px" $mb="4px">
				<Container $preset="row" $gap="4px">
					<Server size={16} className="text-vscode-descriptionForeground" />
					{serverName && <span className="font-bold text-vscode-foreground">{serverName}</span>}
				</Container>
				<StatusHeader
					status={status}
					responseText={responseText}
					isResponseExpanded={isResponseExpanded}
					onToggleResponseExpand={onToggleResponseExpand}
				/>
			</Container>
			<Container $theme="card" $preset="col" $gap="0" $p="8px" $w="100%">
				<ToolSection
					useMcpServer={useMcpServer}
					toolName={toolName}
					serverName={serverName}
					server={server}
					alwaysAllowMcp={alwaysAllowMcp}
				/>
				<ArgumentsBlock
					isArguments={isArguments}
					useMcpServer={useMcpServer}
					argumentsText={argumentsText}
					formattedText={formattedArgumentsText}
					toolName={toolName}
					serverName={serverName}
				/>
				<ResponseContainer
					isExpanded={isResponseExpanded}
					response={formattedResponseText}
					isJson={responseIsJson}
					hasArguments={!!(isArguments || useMcpServer?.arguments || argumentsText)}
					isPartial={status ? status.status !== "completed" : false}
				/>
			</Container>
		</>
	)
}

McpExecution.displayName = "McpExecution"
