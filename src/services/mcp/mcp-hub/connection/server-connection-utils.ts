import { readResource as readResourceHelper } from "@services/mcp/features/resources"

import type { McpResourceResponse } from "@jabberwock/types"
import type { McpHubState, ConnectedMcpConnection } from "@services/mcp/core/types"
import { findConnection } from "./manager"

// ─── Require connected connection ────────────────────────────────────

export function requireConnectedConnection(
	state: McpHubState,
	serverName: string,
	source?: "global" | "project",
): ConnectedMcpConnection {
	const connection = findConnection(state, serverName, source)
	if (!connection || connection.type !== "connected") {
		throw new Error(
			`No connection found for server: ${serverName}${source ? ` with source ${source}` : ""}. Please make sure to use MCP servers available under 'Connected MCP Servers'.`,
		)
	}
	return connection
}

// ─── Read resource ───────────────────────────────────────────────────

export async function readResource(
	state: McpHubState,
	serverName: string,
	uri: string,
	source?: "global" | "project",
): Promise<McpResourceResponse> {
	return readResourceHelper(serverName, uri, source, (name, s) => findConnection(state, name, s))
}
