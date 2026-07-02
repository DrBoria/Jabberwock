import { IntentConstants } from "@intentConstants"
import type { CheckpointData } from "./emitBroadcast"
import { emitBroadcast } from "./emitBroadcast"
import type { NotificationSay, ToolProgressStatus, ContextCondense, ContextTruncation } from "@jabberwock/types"

/**
 * Broadcast an agent (assistant) message to the task's message feed.
 *
 * Agent messages include assistant responses (text, reasoning, completion results),
 * tool calls, and any messages originating from the AI agent during task execution.
 *
 * Creates an `IntentConstants.messages.AGENT_BROADCAST` intent which is handled
 * by `on-message-broadcast.ts` to add the notification to the MST store and push
 * the snapshot to the webview.
 */
export function agentBroadcast(
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
	const intent = IntentConstants.messages.AGENT_BROADCAST
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
