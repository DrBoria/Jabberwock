import type { NotificationSay } from "@jabberwock/types"
import { systemBroadcast } from "@features/chat/task/messages/actions/say/systemBroadcast"

/**
 * Sends an error message saying a required tool parameter is missing.
 *
 * Uses systemBroadcast directly (no dependency on the legacy say() function).
 * Returns a formatted error string for the tool result.
 */
export async function sayAndCreateMissingParamError(
	taskId: string,
	toolName: string,
	paramName: string,
	relPath?: string,
): Promise<string> {
	await systemBroadcast(
		taskId,
		"error" as NotificationSay,
		`Jabberwock tried to use ${toolName}${
			relPath ? ` for '${relPath}'` : ""
		} but it wasn't provided values for the '${paramName}' parameter. You can retry with the proper parameter values.`,
	)
	return `Missing parameter: ${paramName}`
}
