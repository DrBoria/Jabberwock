import {
	ListResourcesResultSchema,
	ListResourceTemplatesResultSchema,
	ReadResourceResultSchema,
} from "@modelcontextprotocol/sdk/types.js"

import type { McpResource, McpResourceResponse, McpResourceTemplate } from "@jabberwock/types"

import type { McpConnection } from "@services/mcp/core/types"

// ─── Fetch resources list ────────────────────────────────────────────

export async function fetchResourcesList(
	serverName: string,
	source: "global" | "project" | undefined,
	findConnection: (name: string, s?: "global" | "project") => McpConnection | undefined,
): Promise<McpResource[]> {
	try {
		const connection = findConnection(serverName, source)
		if (!connection || connection.type !== "connected") {
			return []
		}
		const response = await connection.client.request({ method: "resources/list" }, ListResourcesResultSchema)
		return (response?.resources?.map((r) => ({
			uri: r.uri ?? "",
			name: r.name ?? "",
			description: r.description,
			mimeType: r.mimeType,
		})) || []) as McpResource[]
	} catch {
		return []
	}
}

// ─── Fetch resource templates list ───────────────────────────────────

export async function fetchResourceTemplatesList(
	serverName: string,
	source: "global" | "project" | undefined,
	findConnection: (name: string, s?: "global" | "project") => McpConnection | undefined,
): Promise<McpResourceTemplate[]> {
	try {
		const connection = findConnection(serverName, source)
		if (!connection || connection.type !== "connected") {
			return []
		}
		const response = await connection.client.request(
			{ method: "resources/templates/list" },
			ListResourceTemplatesResultSchema,
		)
		return (response?.resourceTemplates?.map((t) => ({
			uriTemplate: t.uriTemplate ?? "",
			name: t.name ?? "",
			description: t.description,
			mimeType: t.mimeType,
		})) || []) as McpResourceTemplate[]
	} catch {
		return []
	}
}

// ─── Read resource ───────────────────────────────────────────────────

export async function readResource(
	serverName: string,
	uri: string,
	source: "global" | "project" | undefined,
	findConnection: (name: string, s?: "global" | "project") => McpConnection | undefined,
): Promise<McpResourceResponse> {
	const connection = findConnection(serverName, source)
	if (!connection || connection.type !== "connected") {
		throw new Error(`No connection found for server: ${serverName}${source ? ` with source ${source}` : ""}`)
	}
	if (connection.server.disabled) {
		throw new Error(`Server "${serverName}" is disabled`)
	}
	const response = await connection.client.request(
		{
			method: "resources/read",
			params: {
				uri,
			},
		},
		ReadResourceResultSchema,
	)

	return {
		contents: (response?.contents || []).map((c) => ({
			uri: c.uri ?? uri,
			mimeType: c.mimeType,
			text: c.text,
			blob: c.blob,
		})),
	} as McpResourceResponse
}
