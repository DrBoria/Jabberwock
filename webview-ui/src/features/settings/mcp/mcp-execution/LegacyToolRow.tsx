import McpToolRow from "@src/features/settings/mcp/components/McpToolRow"
import type { LegacyToolRowProps } from "./types"

export const LegacyToolRow = ({ toolName, serverName, alwaysAllowMcp }: LegacyToolRowProps) => (
	<div onClick={(e) => e.stopPropagation()}>
		<McpToolRow
			tool={{ name: toolName || "", description: "", alwaysAllow: false }}
			serverName={serverName}
			serverSource={undefined}
			alwaysAllowMcp={alwaysAllowMcp}
			isInChatContext={true}
		/>
	</div>
)
