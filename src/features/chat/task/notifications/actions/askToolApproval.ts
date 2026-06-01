import { IntentConstants } from "@intentConstants"
import { emitAsk } from "./emitAsk"
import type { NotificationAsk, AskResponseValue, ToolProgressStatus } from "@jabberwock/types"

/**
 * Ask the user for tool/capability approval.
 *
 * Handles ask types that require explicit user approval:
 * - `tool` — approve/reject a tool call
 * - `command` — approve/reject a command execution
 * - `use_mcp_server` — approve/reject MCP server access
 * - `api_req_failed` — notify/confirm API request failure
 * - `interactive_app` — approve interactive app launch
 *
 * Creates an `IntentConstants.notifications.ASK_TOOL_APPROVAL` intent
 * for the UI dialog, then waits for the user's response.
 */
export async function askToolApproval(
	taskId: string,
	type: NotificationAsk,
	text?: string,
	partial?: boolean,
	progressStatus?: ToolProgressStatus,
	isProtected?: boolean,
): Promise<{ response: AskResponseValue; text?: string; images?: string[] }> {
	return emitAsk(
		taskId,
		IntentConstants.notifications.ASK_TOOL_APPROVAL,
		type,
		text,
		partial,
		progressStatus,
		isProtected,
	)
}
