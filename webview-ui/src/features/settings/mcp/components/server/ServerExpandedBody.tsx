import type { McpServer } from "@jabberwock/types"
import { ServerInfoTabs } from "./mcp-server-info-tabs"
import { NetworkTimeoutSelector } from "./mcp-server-settings"

interface ServerExpandedBodyProps {
	server: McpServer
	alwaysAllowMcp?: boolean
	timeoutValue: number
	onTimeoutChange: (event: React.ChangeEvent<HTMLSelectElement>) => void
}

export const ServerExpandedBody = ({
	server,
	alwaysAllowMcp,
	timeoutValue,
	onTimeoutChange,
}: ServerExpandedBodyProps) => (
	<div
		style={{
			background: "var(--vscode-textCodeBlock-background)",
			padding: "0 10px 10px 10px",
			fontSize: "13px",
			borderRadius: "0 0 4px 4px",
		}}>
		<ServerInfoTabs server={server} alwaysAllowMcp={alwaysAllowMcp} />
		<NetworkTimeoutSelector timeoutValue={timeoutValue} onTimeoutChange={onTimeoutChange} />
	</div>
)
