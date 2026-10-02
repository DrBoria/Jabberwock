import type { ToolSectionProps } from "@src/features/settings/mcp/mcp-execution/types"
import { UseMcpToolRow } from "./tool-row"
import { LegacyToolRow } from "@src/features/settings/mcp/mcp-execution/LegacyToolRow"

export const ToolSection = ({ useMcpServer, server, toolName, serverName, alwaysAllowMcp }: ToolSectionProps) => (
	<>
		{useMcpServer?.type === "use_mcp_tool" && (
			<UseMcpToolRow useMcpServer={useMcpServer} server={server} alwaysAllowMcp={alwaysAllowMcp} />
		)}
		{!useMcpServer && !!toolName && !!serverName && (
			<LegacyToolRow toolName={toolName} serverName={serverName} alwaysAllowMcp={alwaysAllowMcp} />
		)}
	</>
)
