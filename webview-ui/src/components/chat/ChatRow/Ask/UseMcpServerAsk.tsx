import React from "react"
import type { ClineMessage, ClineAskUseMcpServer } from "@jabberwock/types"
import { safeJsonParse } from "@shared/core"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { findMatchingResourceOrTemplate } from "@src/utils/mcp"
import McpResourceRow from "../../../mcp/McpResourceRow"
import { McpExecution } from "../../McpExecution"
import { Container } from "@src/components/ui"

import { McpIframeRenderer } from "../../../../features/mcp-apps/McpIframeRenderer"
import { vscode } from "@src/utils/vscode"

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

	const server = mcpServers.find((s) => s.name === useMcpServer.serverName)

	// Check if the MCP server has an HTTP UI server by reading its config env vars.
	// The server config can specify:
	//   - HTTP_URL: full URL to the HTTP UI (e.g. "https://my-mcp-server.example.com/ui")
	//   - HTTP_PORT: port number, assumes localhost (e.g. "3005" → "http://localhost:3005")
	// This is generic — works for any MCP server with HTTP support, on any domain.
	const serverResourceUri = React.useMemo<string | null>(() => {
		if (!server) return null
		try {
			const config = JSON.parse(server.config)
			const env = config?.env
			if (!env) return null
			// Full URL takes precedence (supports external domains)
			if (env.HTTP_URL) return env.HTTP_URL
			// Port-only fallback (assumes localhost)
			if (env.HTTP_PORT) return `http://localhost:${env.HTTP_PORT}`
			return null
		} catch {
			return null
		}
	}, [server])

	if (!useMcpServer) return null

	if (serverResourceUri && useMcpServer.type === "use_mcp_tool") {
		return (
			<>
				<Container preset="header" p="0">
					{icon}
					{title}
				</Container>
				<div className="mt-2">
					<McpIframeRenderer
						resourceUri={serverResourceUri}
						agentsList="[]"
						inputData={useMcpServer.arguments !== "{}" ? useMcpServer.arguments : undefined}
						onResolve={() => {
							vscode.postMessage({
								type: "askResponse",
								askResponse: "yesButtonClicked",
							})
						}}
						onCancel={() => {
							vscode.postMessage({
								type: "askResponse",
								askResponse: "noButtonClicked",
							})
						}}
					/>
				</div>
			</>
		)
	}

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
