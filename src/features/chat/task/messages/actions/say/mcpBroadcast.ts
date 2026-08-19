import { IntentConstants } from "@intentConstants"
import type { CheckpointData } from "./emitBroadcast"
import { emitBroadcast } from "./emitBroadcast"
import type { NotificationSay, ToolProgressStatus, ContextCondense, ContextTruncation } from "@jabberwock/types"

/**
 * Broadcast an MCP tool message to the task's message feed.
 *
 * MCP tool messages include MCP server request start notifications and
 * MCP server responses, showing when the agent interacts with MCP tools.
 *
 * Creates an `IntentConstants.messages.MCP_BROADCAST` intent which is handled
 * by `on-message-broadcast.ts` to add the notification to the MST store and push
 * the snapshot to the webview.
 */
export function mcpBroadcast(
	taskId: string,
	type: NotificationSay,
	text?: string,
	images?: string[],
	partial?: boolean,
	checkpoint?: CheckpointData,
	progressStatus?: ToolProgressStatus,
	options?: { isNonInteractive?: boolean },
	contextCondense?: ContextCondense,
	contextTruncation?: ContextTruncation,
): Promise<undefined> {
	const intent = IntentConstants.messages.MCP_BROADCAST
	return emitBroadcast(
		taskId,
		intent,
		type,
		text,
		images,
		partial,
		checkpoint,
		progressStatus,
		options,
		contextCondense,
		contextTruncation,
	)
}
