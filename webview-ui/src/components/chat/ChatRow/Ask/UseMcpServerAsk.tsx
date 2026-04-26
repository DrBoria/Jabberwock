import React from "react"
import type { ClineMessage, ClineAskUseMcpServer } from "@jabberwock/types"
import { safeJsonParse } from "@shared/core"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { findMatchingResourceOrTemplate } from "@src/utils/mcp"
import McpResourceRow from "../../../mcp/McpResourceRow"
import { McpExecution } from "../../McpExecution"
import { Container } from "@src/components/ui"

interface UseMcpServerAskProps {
	message: ClineMessage
	icon: React.ReactNode
	title: React.ReactNode
	t: (key: string, options?: any) => string
}

export const UseMcpServerAsk: React.FC<UseMcpServerAskProps> = ({ message, icon, title, t: _t }) => {
	const { mcpServers, alwaysAllowMcp, customModes: _customModes } = useExtensionState()

	const messageJson = safeJsonParse<any>(message.text, {})
	const { response, ...mcpServerRequest } = messageJson
	const useMcpServer: ClineAskUseMcpServer = {
		...mcpServerRequest,
		response,
	}

	if (!useMcpServer) return null

	const server = mcpServers.find((s) => s.name === useMcpServer.serverName)

	return (
		<>
			<Container preset="header" p="0">
				{icon}
				{title}
			</Container>
			<Container theme="card" preset="col" gap="0" mt="8px" p="8px">
				{useMcpServer.type === "access_mcp_resource" && (
					<McpResourceRow
						item={{
							...(findMatchingResourceOrTemplate(
								useMcpServer.uri || "",
								server?.resources,
								server?.resourceTemplates,
							) || {
								name: "",
								mimeType: "",
								description: "",
							}),
							uri: useMcpServer.uri || "",
						}}
					/>
				)}
				{useMcpServer.type === "use_mcp_tool" && (
					<McpExecution
						executionId={message.ts.toString()}
						text={useMcpServer.arguments !== "{}" ? useMcpServer.arguments : undefined}
						serverName={useMcpServer.serverName}
						toolName={useMcpServer.toolName}
						isArguments={true}
						server={server}
						useMcpServer={useMcpServer}
						alwaysAllowMcp={alwaysAllowMcp}
					/>
				)}
			</Container>
		</>
	)
}
