import React from "react"
import type { Notification, McpServerRequestData, McpServer } from "@jabberwock/types"
import { safeJsonParse } from "@jabberwock/core/browser"
import { observer } from "mobx-react-lite"
import { findMatchingResourceOrTemplate } from "@/utils/misc/mcp"
import McpResourceRow from "@src/features/settings/mcp/components/McpResourceRow"
import { McpExecution } from "@src/features/settings/mcp/mcp-execution"
import { Container } from "@src/shared/ui/layouts/Container"
import { getAllModes } from "@shared/modes"
import { McpIframeRenderer } from "@src/features/settings/mcp/McpIframeRenderer"
import { rootStore } from "@src/features/store"
import {
	getServerResourceUri,
	formatRawArgs,
	chevronStyle,
	chevronActiveStyle,
	rawToggleStyle,
	rawToggleBorderStyle,
	preStyle,
} from "../mcp-server-ask-utils"

interface UseMcpServerAskProps {
	message: Notification
	icon: React.ReactNode
	title: React.ReactNode
	t: (key: string, options?: Record<string, unknown>) => string
}

interface McpInteractiveViewProps {
	icon: React.ReactNode
	title: React.ReactNode
	serverResourceUri: string
	agentsList: string
	useMcpServer: McpServerRequestData
}

const McpInteractiveView: React.FC<McpInteractiveViewProps> = ({
	icon,
	title,
	serverResourceUri,
	agentsList,
	useMcpServer,
}) => {
	const [showRawArgs, setShowRawArgs] = React.useState(false)
	return (
		<>
			<Container $preset="header" $p="0">
				{icon}
				{title}
			</Container>
			<div
				style={showRawArgs ? rawToggleBorderStyle : rawToggleStyle}
				onClick={() => setShowRawArgs(!showRawArgs)}>
				<svg
					width="10"
					height="10"
					viewBox="0 0 16 16"
					fill="currentColor"
					style={showRawArgs ? chevronActiveStyle : chevronStyle}>
					<path d="M6 4l4 4-4 4V4z" />
				</svg>
				<span>Raw agent arguments</span>
			</div>
			{showRawArgs && <pre style={preStyle}>{formatRawArgs(useMcpServer.arguments)}</pre>}
			<div className="mt-2">
				<McpIframeRenderer
					resourceUri={serverResourceUri}
					agentsList={agentsList}
					inputData={useMcpServer.arguments !== "{}" ? useMcpServer.arguments : undefined}
					onResolve={() => rootStore.chat.respondToAsk("yesButtonClicked")}
					onCancel={() => rootStore.chat.respondToAsk("noButtonClicked")}
				/>
			</div>
		</>
	)
}

interface McpServerAskDetailsProps {
	icon: React.ReactNode
	title: React.ReactNode
	useMcpServer: McpServerRequestData
	server: McpServer | undefined
	alwaysAllowMcp?: boolean
	message: Notification
}

const getMcpResourceItem = (useMcpServer: McpServerRequestData, server: McpServer | undefined) => {
	const match = findMatchingResourceOrTemplate(useMcpServer.uri || "", server?.resources, server?.resourceTemplates)
	return { ...(match || { name: "", mimeType: "", description: "" }), uri: useMcpServer.uri || "" }
}

const McpServerAskDetails: React.FC<McpServerAskDetailsProps> = ({
	icon,
	title,
	useMcpServer,
	server,
	alwaysAllowMcp,
	message,
}) => (
	<>
		<Container $preset="header" $p="0">
			{icon}
			{title}
		</Container>
		<Container $theme="card" $preset="col" $gap="0" $mt="8px" $p="8px">
			{useMcpServer.type === "access_mcp_resource" && (
				<McpResourceRow item={getMcpResourceItem(useMcpServer, server)} />
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

export const UseMcpServerAsk: React.FC<UseMcpServerAskProps> = observer(({ message, icon, title, t: _t }) => {
	const mcpServers = rootStore.settings.mcpServers
	const alwaysAllowMcp = rootStore.extensionState.alwaysAllowMcp
	const customModes = rootStore.extensionState.customModes
	const useMcpServer = safeJsonParse<McpServerRequestData>(message.text, { serverName: "", type: "use_mcp_tool" })!
	const server = mcpServers.find((s) => s.name === useMcpServer.serverName)
	const allowedContextData = {
		agents: getAllModes(customModes)
			.map((m: { slug: string; name: string }) => ({ slug: m.slug, name: m.name }))
			.filter(Boolean),
	}
	const serverResourceUri = React.useMemo<string | null>(() => getServerResourceUri(server), [server])

	if (serverResourceUri && useMcpServer.type === "use_mcp_tool") {
		return (
			<McpInteractiveView
				icon={icon}
				title={title}
				serverResourceUri={serverResourceUri}
				agentsList={JSON.stringify(allowedContextData.agents)}
				useMcpServer={useMcpServer}
			/>
		)
	}

	return (
		<McpServerAskDetails
			icon={icon}
			title={title}
			useMcpServer={useMcpServer}
			server={server}
			alwaysAllowMcp={alwaysAllowMcp}
			message={message}
		/>
	)
})
