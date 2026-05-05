import { types, Instance } from "mobx-state-tree"

/**
 * McpServersStore — tracks MCP server list.
 * Receives snapshots from the extension-side McpServersStore via MstBridge.
 */
export const McpServersStore = types
	.model("McpServersStore", {
		servers: types.optional(types.array(types.frozen<any>()), []),
	})
	.actions((self) => ({
		setServers(servers: any[]) {
			self.servers.replace(servers)
		},
	}))

export type IMcpServersStore = Instance<typeof McpServersStore>
export const mcpServersStore = McpServersStore.create({})
