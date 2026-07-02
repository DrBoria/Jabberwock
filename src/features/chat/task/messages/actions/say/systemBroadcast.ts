import { IntentConstants } from "@intentConstants"
import type { CheckpointData } from "./emitBroadcast"
import { emitBroadcast } from "./emitBroadcast"
import type { NotificationSay, ToolProgressStatus, ContextCondense, ContextTruncation } from "@jabberwock/types"

/**
 * Broadcast a system-level message to the task's message feed.
 *
 * System messages include API request status updates, checkpoint saves,
 * error messages, context condensation/truncation events, and other
 * operational messages that inform the user of system activity.
 *
 * Creates an `IntentConstants.messages.SYSTEM_BROADCAST` intent which is handled
 * by `on-message-broadcast.ts` to add the notification to the MST store and push
 * the snapshot to the webview.
 */
export function systemBroadcast(
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
	const intent = IntentConstants.messages.SYSTEM_BROADCAST
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
