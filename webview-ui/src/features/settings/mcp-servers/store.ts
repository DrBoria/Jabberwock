import { types, Instance } from "mobx-state-tree"

import type { McpServer } from "@jabberwock/types"

/**
 * McpServersStore — tracks MCP server list.
 * Receives snapshots from the extension-side McpServersStore via MstBridge.
 */
export const McpServersStore = types
	.model("McpServersStore", {
		servers: types.array(types.frozen<McpServer>()),
	})
	.actions((self) => ({
		setServers(servers: McpServer[]) {
			self.servers.replace(servers)
		},
	}))

export type IMcpServersStore = Instance<typeof McpServersStore>
export const mcpServersStore = McpServersStore.create({})
