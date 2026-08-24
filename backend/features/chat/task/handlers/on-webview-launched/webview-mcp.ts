import { getMcpServerManager } from "@services/mcp/core/McpServerManager"
import { getMstState } from "@features/foundation/mst/store"

export function syncMcpServers(
	provider: { postMessageToWebview: (msg: unknown) => Promise<void> },
	rootStore: never,
): void {
	const mcpHub = getMcpServerManager().getMcpHub()

	if (mcpHub) {
		const servers = mcpHub.getAllServers()

		void provider.postMessageToWebview({ type: "mcpServers", mcpServers: servers })
		const mstState = getMstState(rootStore)
		mstState.mcpServersStore?.setServers(servers)
	}
}
