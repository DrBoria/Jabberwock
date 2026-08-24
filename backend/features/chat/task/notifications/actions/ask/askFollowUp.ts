import { IntentConstants } from "@intentConstants"
import { emitAsk } from "@features/chat/task/notifications/actions/emitAsk"
import type { NotificationAsk, AskResponseValue, ToolProgressStatus } from "@jabberwock/types"

/**
 * Ask the user a follow-up question.
 *
 * Handles ask types that require user input or decision:
 * - `followup` — general follow-up question
 * - `resume_task` — confirm task resumption
 * - `resume_completed_task` — confirm completed task resumption
 *
 * Creates an `IntentConstants.notifications.ASK_FOLLOW_UP` intent
 * for the UI dialog, then waits for the user's response.
 */
export function askFollowUp(
	taskId: string,
	type: NotificationAsk,
	text?: string,
	partial?: boolean,
	progressStatus?: ToolProgressStatus,
	isProtected?: boolean,
): Promise<{ response: AskResponseValue; text?: string; images?: string[] }> {
	const notificationType = IntentConstants.notifications.ASK_FOLLOW_UP
	return emitAsk(taskId, notificationType, type, text, partial, progressStatus, isProtected)
}
