import McpToolRow from "@src/features/settings/mcp/components/tool"
import type { UseMcpToolRowProps } from "@src/features/settings/mcp/mcp-execution/types"

export const UseMcpToolRow = ({ useMcpServer, server, alwaysAllowMcp }: UseMcpToolRowProps) => {
	const matchedTool = server?.tools?.find((t) => t.name === useMcpServer.toolName)
	return (
		<div onClick={(e) => e.stopPropagation()}>
			<McpToolRow
				tool={{
					name: useMcpServer.toolName || "",
					description: matchedTool?.description || "",
					alwaysAllow: matchedTool?.alwaysAllow ?? false,
				}}
				serverName={useMcpServer.serverName}
				serverSource={server?.source}
				alwaysAllowMcp={alwaysAllowMcp}
				isInChatContext={true}
			/>
		</div>
	)
}
