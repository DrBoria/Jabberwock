import { IntentConstants } from "@intentConstants"
import { emitAsk } from "./emitAsk"
import type { NotificationAsk, AskResponseValue, ToolProgressStatus } from "@jabberwock/types"

/**
 * Ask the user for sub-task completion approval.
 *
 * Handles ask types related to sub-task lifecycle:
 * - `completion_result` — confirm sub-task result
 * - `mistake_limit_reached` — notify of max mistakes reached
 * - `auto_approval_max_req_reached` — notify of auto-approval limit
 * - `command_output` — present command output for review
 *
 * Creates an `IntentConstants.notifications.ASK_SUB_TASK` intent
 * for the UI dialog, then waits for the user's response.
 */
export async function askSubTask(
	taskId: string,
	type: NotificationAsk,
	text?: string,
	partial?: boolean,
	progressStatus?: ToolProgressStatus,
	isProtected?: boolean,
): Promise<{ response: AskResponseValue; text?: string; images?: string[] }> {
	return emitAsk(taskId, IntentConstants.notifications.ASK_SUB_TASK, type, text, partial, progressStatus, isProtected)
}
