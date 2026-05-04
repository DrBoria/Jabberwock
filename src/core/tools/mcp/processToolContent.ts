import type { McpExecutionStatus } from "@jabberwock/types"

import { Task } from "../../task/Task"

/**
 * Processes the raw tool result from an MCP call into text and images.
 * Handles text, resource, and image content types.
 */
export function processToolContent(toolResult: any): { text: string; images: string[] } {
	if (!toolResult?.content || toolResult.content.length === 0) {
		return { text: "", images: [] }
	}

	const images: string[] = []

	const textContent = toolResult.content
		.map((item: any) => {
			if (item.type === "text") {
				return item.text
			}
			if (item.type === "resource") {
				const { blob: _, ...rest } = item.resource
				return JSON.stringify(rest, null, 2)
			}
			if (item.type === "image") {
				// Handle image content (MCP image content has mimeType and data properties)
				if (item.mimeType && item.data) {
					if (item.data.startsWith("data:")) {
						images.push(item.data)
					} else {
						images.push(`data:${item.mimeType};base64,${item.data}`)
					}
				}
				return ""
			}
			return ""
		})
		.filter(Boolean)
		.join("\n\n")

	return { text: textContent, images }
}

/**
 * Sends an MCP execution status update to the webview via postMessage and MST store.
 * Used to show real-time progress indicators in the UI.
 */
export async function sendExecutionStatus(task: Task, status: McpExecutionStatus): Promise<void> {
	const clineProvider = await task.providerRef.deref()
	// Dual-write: keep postMessage for backward compat, add MST store write
	clineProvider?.postMessageToWebview({
		type: "mcpExecutionStatus",
		text: JSON.stringify(status),
	})
	clineProvider?.mcpExecutionStore?.addOrUpdateExecution(status)
}
