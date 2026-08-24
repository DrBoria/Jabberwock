import { useState, useEffect } from "react"
import { Container } from "@src/shared/ui/layouts/Container"
import type { McpExecutionProps } from "../types"
import { StatusBar } from "./StatusBar"
import { ToolSection } from "./ToolSection"
import { ArgumentsSection } from "./ArgumentsSection"
import { ResponseContainer } from "./ResponseContainer"
import { useMcpExecutionState } from "../useMcpExecutionState"

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
	const [serverName, setServerName] = useState(initialServerName)
	const [toolName, setToolName] = useState(initialToolName)
	useEffect(() => {
		if (initialServerName && initialServerName !== serverName) setServerName(initialServerName)
	}, [initialServerName, serverName])
	useEffect(() => {
		if (initialToolName && initialToolName !== toolName) setToolName(initialToolName)
	}, [initialToolName, toolName])
	const {
		t,
		status,
		responseText,
		isResponseExpanded,
		responseIsJson,
		formattedResponseText,
		formattedArgumentsText,
		isUseMcpTool,
		hasToolNameAndServer,
		isPartial,
		showToolSection,
		hasArguments,
		onToggleResponseExpand,
	} = useMcpExecutionState({ executionId, text, useMcpServer, serverName, toolName, isArguments })
	return (
		<>
			<StatusBar
				status={status}
				serverName={serverName}
				responseText={responseText}
				isResponseExpanded={isResponseExpanded}
				onToggleResponseExpand={onToggleResponseExpand}
				t={t}
			/>
			<Container $theme="card" $preset="col" $gap="0" $p="8px" $w="100%">
				{showToolSection && (
					<ToolSection
						useMcpServer={useMcpServer}
						server={server}
						toolName={toolName}
						serverName={serverName}
						alwaysAllowMcp={alwaysAllowMcp}
					/>
				)}
				{hasArguments && (
					<ArgumentsSection
						formattedArgumentsText={formattedArgumentsText}
						isArguments={isArguments}
						isUseMcpTool={isUseMcpTool}
						hasToolNameAndServer={hasToolNameAndServer}
					/>
				)}
				<ResponseContainer
					isExpanded={isResponseExpanded}
					response={formattedResponseText}
					isJson={responseIsJson}
					hasArguments={hasArguments}
					isPartial={isPartial}
				/>
			</Container>
		</>
	)
}

McpExecution.displayName = "McpExecution"
