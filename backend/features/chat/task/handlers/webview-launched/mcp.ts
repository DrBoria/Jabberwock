import { getMcpServerManager } from "@services/mcp/core/McpServerManager"
import { sendMcpServersToProvider } from "@features/settings"

export function syncMcpServers(provider: { postMessageToWebview: (msg: unknown) => Promise<void> }): void {
	const mcpHub = getMcpServerManager().getMcpHub()

	if (mcpHub) {
		const servers = mcpHub.getAllServers()

		void sendMcpServersToProvider(provider, servers)
	}
}
