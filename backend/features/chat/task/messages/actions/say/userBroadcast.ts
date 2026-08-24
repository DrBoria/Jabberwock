import { IntentConstants } from "@intentConstants"
import type { CheckpointData } from "./emitBroadcast"
import { emitBroadcast } from "./emitBroadcast"
import type { NotificationSay, ToolProgressStatus, ContextCondense, ContextTruncation } from "@jabberwock/types"

/**
 * Broadcast a user-originated message to the task's message feed.
 *
 * User messages include user feedback, command output, subtask results,
 * user edits to the todo list, and other content submitted by the user.
 *
 * Creates an `IntentConstants.messages.USER_BROADCAST` intent which is handled
 * by `on-message-broadcast.ts` to add the notification to the MST store and push
 * the snapshot to the webview.
 */
export function userBroadcast(
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
	const intent = IntentConstants.messages.USER_BROADCAST
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
