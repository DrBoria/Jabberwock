import { IntentConstants } from "@intentConstants"
import { emitAsk } from "./emitAsk"
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
export async function askFollowUp(
	taskId: string,
	type: NotificationAsk,
	text?: string,
	partial?: boolean,
	progressStatus?: ToolProgressStatus,
	isProtected?: boolean,
): Promise<{ response: AskResponseValue; text?: string; images?: string[] }> {
	return emitAsk(
		taskId,
		IntentConstants.notifications.ASK_FOLLOW_UP,
		type,
		text,
		partial,
		progressStatus,
		isProtected,
	)
}
