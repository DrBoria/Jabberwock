import React from "react"
import type { ClineMessage, ClineAskUseMcpServer } from "@jabberwock/types"
import { safeJsonParse } from "@shared/core"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { findMatchingResourceOrTemplate } from "@src/features/settings/utils/mcp"
import McpResourceRow from "@src/components/mcp/McpResourceRow"
import { McpExecution } from "@src/features/settings/mcp/mcp-execution"
import { Container } from "@src/components/ui"
import { getAllModes } from "@shared/modes"

import { McpIframeRenderer } from "@src/features/settings/mcp/McpIframeRenderer"
import { vscode } from "@jabberwock/devtool/react"

interface UseMcpServerAskProps {
	message: ClineMessage
	icon: React.ReactNode
	title: React.ReactNode
	t: (key: string, options?: any) => string
}

export const UseMcpServerAsk: React.FC<UseMcpServerAskProps> = ({ message, icon, title, t: _t }) => {
	const [showRawArgs, setShowRawArgs] = React.useState(false)
	const { mcpServers, alwaysAllowMcp, customModes } = useExtensionState()

	const messageJson = safeJsonParse<any>(message.text, {})
	const { response, ...mcpServerRequest } = messageJson
	const useMcpServer: ClineAskUseMcpServer = {
		...mcpServerRequest,
		response,
	}

	const server = mcpServers.find((s) => s.name === useMcpServer.serverName)

	// Check if the MCP server has an HTTP UI server by reading its config.
	// The server config can specify:
	//   - type: "interactiveApp" — marks the server as having an interactive UI
	//   - env.HTTP_URL: full URL to the HTTP UI (e.g. "https://my-mcp-server.example.com/ui")
	//   - env.HTTP_PORT: port number, assumes localhost (e.g. "3005" → "http://localhost:3005")
	// This is generic — works for any MCP server with HTTP support, on any domain.
	const allowedContextData = {
		agents: getAllModes(customModes)
			.map((m: any) => ({ slug: m.slug, name: m.name }))
			.filter(Boolean),
	}

	const serverResourceUri = React.useMemo<string | null>(() => {
		if (!server) return null
		try {
			const config = JSON.parse(server.config)
			// Check env vars first (explicit configuration)
			const env = config?.env
			if (env) {
				if (env.HTTP_URL) return env.HTTP_URL
				if (env.HTTP_PORT) return `http://localhost:${env.HTTP_PORT}`
			}
			// For interactiveApp type servers, try to extract HTTP port from arguments
			// (e.g., md-todo-mcp reads HTTP_PORT from process.env or defaults to 3005)
			if (config?.type === "interactiveApp") {
				// Check if arguments contain HTTP_PORT or HTTP_URL
				const args = config?.args
				if (Array.isArray(args)) {
					const argsStr = args.join(" ")
					const portMatch = argsStr.match(/HTTP_PORT=(\d+)/)
					if (portMatch) return `http://localhost:${portMatch[1]}`
					const urlMatch = argsStr.match(/HTTP_URL=(\S+)/)
					if (urlMatch) return urlMatch[1]
				}
				// Default fallback for interactiveApp servers: try common ports
				// md-todo-mcp defaults to 3005
				return "http://localhost:3005"
			}
			return null
		} catch {
			return null
		}
	}, [server])

	if (serverResourceUri && useMcpServer.type === "use_mcp_tool") {
		return (
			<>
				<Container $preset="header" $p="0">
					{icon}
					{title}
				</Container>
				<div
					style={{
						padding: "4px 12px",
						fontSize: "11px",
						color: "var(--vscode-descriptionForeground)",
						cursor: "pointer",
						userSelect: "none",
						display: "flex",
						alignItems: "center",
						gap: "4px",
						borderBottom: showRawArgs ? "1px solid var(--vscode-widget-border, #454545)" : "none",
					}}
					onClick={() => setShowRawArgs(!showRawArgs)}>
					<svg
						width="10"
						height="10"
						viewBox="0 0 16 16"
						fill="currentColor"
						style={{
							transform: showRawArgs ? "rotate(90deg)" : "rotate(0deg)",
							transition: "transform 0.1s",
						}}>
						<path d="M6 4l4 4-4 4V4z" />
					</svg>
					<span>Raw agent arguments</span>
				</div>
				{showRawArgs && (
					<pre
						style={{
							margin: 0,
							padding: "8px 12px",
							fontSize: "11px",
							lineHeight: 1.4,
							backgroundColor: "var(--vscode-textCodeBlock-background)",
							color: "var(--vscode-editor-foreground)",
							overflowX: "auto",
							whiteSpace: "pre-wrap",
							wordBreak: "break-word",
							borderBottom: "1px solid var(--vscode-widget-border, #454545)",
						}}>
						{(() => {
							try {
								return JSON.stringify(JSON.parse(useMcpServer.arguments || "{}"), null, 2)
							} catch {
								return useMcpServer.arguments || "{}"
							}
						})()}
					</pre>
				)}
				<div className="mt-2">
					<McpIframeRenderer
						resourceUri={serverResourceUri}
						agentsList={JSON.stringify(allowedContextData.agents)}
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
			<Container $preset="header" $p="0">
				{icon}
				{title}
			</Container>
			<Container $theme="card" $preset="col" $gap="0" $mt="8px" $p="8px">
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
