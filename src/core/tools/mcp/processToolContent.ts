import type { McpExecutionStatus } from "@jabberwock/types"

import { Task } from "../../../features/chat/task/Task"
import { getMstState } from "../../../features/foundation/mst/store"

/**
 * Processes the raw tool result from an MCP call into text and images.
 * Handles text, resource, and image content types.
 */
export function processToolContent(toolResult: { content: Array<Record<string, unknown>> }): {
	text: string
	images: string[]
} {
	if (!toolResult?.content || toolResult.content.length === 0) {
		return { text: "", images: [] }
	}

	const images: string[] = []

	const textContent = toolResult.content
		.map((item: Record<string, unknown>) => {
			if (item.type === "text") {
				const text = item.text
				return typeof text === "string" ? text : JSON.stringify(text)
			}
			if (item.type === "resource") {
				const resource = item.resource
				if (resource != null && typeof resource === "object") {
					const { blob: _, ...rest } = resource as Record<string, unknown> & { blob?: unknown }
					return JSON.stringify(rest, null, 2)
				}
				return ""
			}
			if (item.type === "image") {
				const mimeType = item.mimeType
				const data = item.data
				if (typeof mimeType === "string" && typeof data === "string") {
					if (data.startsWith("data:")) {
						images.push(data)
					} else {
						images.push(`data:${mimeType};base64,${data}`)
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
	if (clineProvider) {
		getMstState(clineProvider).mcpExecutionStore?.addOrUpdateExecution(status)
	}
}
