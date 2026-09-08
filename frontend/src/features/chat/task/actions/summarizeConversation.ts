import { getConnectorBus } from "../../../../connector-bus"
import type { WebviewMessage } from "@jabberwock/types"
import { eventConstants } from "@jabberwock/types"

/**
 * Request a conversation summary (condense) for the given task.
 * This is an alias for {@link condenseContext} that dispatches the same
 * {@link eventConstants.CHAT.TASK.CONDENSE_TASK_CONTEXT_REQUEST} event.
 *
 * The extension host will process the summary and return the condensed result
 * via {@link eventConstants.CHAT.TASK.CONDENSE_TASK_CONTEXT_RESPONSE}.
 *
 * @param taskId - The ID of the task to summarize.
 */
export function summarizeConversation(taskId: string): void {
	getConnectorBus().publish({
		type: eventConstants.CHAT.TASK.CONDENSE_TASK_CONTEXT_REQUEST,
		text: taskId,
	} satisfies WebviewMessage)
}
