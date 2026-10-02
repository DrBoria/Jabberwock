import type { Notification } from "@jabberwock/types"

export function getMessageText(message: Notification): string {
	return message.text ?? ""
}

export function toError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error))
}

export function safeJsonParse<T>(text: string, fallback: T): T {
	try {
		return JSON.parse(text) as T
	} catch {
		return fallback
	}
}

export function parseMcpInfo(text: string): { serverName: string; toolName: string; resourceUri: string } {
	try {
		const mcpInfo = JSON.parse(text) as {
			server_name?: string
			type?: string
			tool_name?: string
			uri?: string
		}
		return {
			serverName: mcpInfo.server_name || "unknown",
			toolName: mcpInfo.type === "use_mcp_tool" ? mcpInfo.tool_name || "" : "",
			resourceUri: mcpInfo.type === "access_mcp_resource" ? mcpInfo.uri || "" : "",
		}
	} catch {
		return { serverName: "unknown", toolName: "", resourceUri: "" }
	}
}

export function formatDisplayValue(value: unknown): string {
	if (typeof value === "string") {
		return value.length > 200 ? value.substring(0, 200) + "..." : value
	}
	if (typeof value === "object" && value !== null) {
		const json = JSON.stringify(value)
		return json.length > 200 ? json.substring(0, 200) + "..." : json
	}
	return String(value)
}
