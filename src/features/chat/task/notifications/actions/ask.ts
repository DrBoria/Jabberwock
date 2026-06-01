import type { NotificationAsk, AskResponseValue, ToolProgressStatus } from "@jabberwock/types"
import { askToolApproval, askFollowUp, askSubTask } from "./index"

/**
 * Map a NotificationAsk type to the appropriate ask action creator.
 *
 * @remarks
 * This is a TEMPORARY mapping used by the legacy `ask()` function to delegate
 * to the new domain-specific action creators. Eventually all callers should
 * import the specific action creator directly.
 *
 * @deprecated Use the domain-specific action creators directly:
 *   - `askToolApproval(taskId, type, ...)` — for tool/capability approval
 *   - `askFollowUp(taskId, type, ...)` — for follow-up questions
 *   - `askSubTask(taskId, type, ...)` — for sub-task completion
 */
function getAskTypeActionCreator(type: NotificationAsk): typeof askToolApproval {
	if (isToolApprovalType(type)) return askToolApproval
	if (isFollowUpType(type)) return askFollowUp
	if (isSubTaskType(type)) return askSubTask
	return askToolApproval // fallback
}

function isToolApprovalType(type: NotificationAsk): boolean {
	switch (type) {
		case "tool":
		case "command":
		case "use_mcp_server":
		case "api_req_failed":
		case "interactive_app":
			return true
		default:
			return false
	}
}

function isFollowUpType(type: NotificationAsk): boolean {
	switch (type) {
		case "followup":
		case "resume_task":
		case "resume_completed_task":
			return true
		default:
			return false
	}
}

function isSubTaskType(type: NotificationAsk): boolean {
	switch (type) {
		case "completion_result":
		case "mistake_limit_reached":
		case "auto_approval_max_req_reached":
		case "command_output":
			return true
		default:
			return false
	}
}

/**
 * Asks the user a question. The task waits for a response before continuing.
 *
 * Uses MobX `when()` to reactively wait for the ask response,
 * instead of polling with setInterval.
 *
 * Delegates to the appropriate domain-specific action creator based on
 * the `type` parameter — the handler does the actual store mutation.
 *
 * @deprecated Use the domain-specific action creators directly:
 *   - `askToolApproval(taskId, type, ...)` — for tool/capability approval
 *   - `askFollowUp(taskId, type, ...)` — for follow-up questions
 *   - `askSubTask(taskId, type, ...)` — for sub-task completion
 */
export async function ask(
	taskId: string,
	type: NotificationAsk,
	text?: string,
	partial?: boolean,
	progressStatus?: ToolProgressStatus,
	isProtected?: boolean,
): Promise<{ response: AskResponseValue; text?: string; images?: string[] }> {
	const actionCreator = getAskTypeActionCreator(type)
	return actionCreator(taskId, type, text, partial, progressStatus, isProtected)
}

/**
 * Re-exports all response handling functions from respondToAsk.ts.
 * These are the canonical taskId-based implementations.
 */
export {
	handleWebviewAskResponse,
	approveAsk,
	denyAsk,
	supersedePendingAsk,
	cancelAutoApprovalTimeout,
} from "./respondToAsk"
