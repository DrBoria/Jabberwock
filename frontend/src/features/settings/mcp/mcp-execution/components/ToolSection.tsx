import type { ToolSectionProps } from "../types"
import { UseMcpToolRow } from "./UseMcpToolRow"
import { LegacyToolRow } from "../LegacyToolRow"

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
