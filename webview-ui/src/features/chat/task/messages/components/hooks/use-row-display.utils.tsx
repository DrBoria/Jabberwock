import type { Notification } from "@jabberwock/types"
import { COMMAND_OUTPUT_STRING } from "@shared/combineCommandSequences"

export const computeRedundantTodo = (message: Notification, effectiveHistory: Notification[]): boolean => {
	if (message.type !== "ask" || message.ask !== "tool" || !message.text) return false
	try {
		const tool = JSON.parse(message.text)
		if (tool.tool !== "updateTodoList") return false
		const myIndex = effectiveHistory.findIndex((m) => m.ts === message.ts)
		return (
			myIndex !== -1 &&
			effectiveHistory.slice(myIndex + 1).some(
				(m) =>
					m.type === "ask" &&
					m.ask === "tool" &&
					(() => {
						try {
							return JSON.parse(m.text || "{}").tool === "updateTodoList"
						} catch {
							return false
						}
					})(),
			)
		)
	} catch {
		return false
	}
}

export const computeApiRequestFailedMessage = (
	isLast: boolean,
	lastModifiedMessage: Notification | undefined,
): string | undefined =>
	isLast && lastModifiedMessage?.ask === "api_req_failed" ? lastModifiedMessage?.text : undefined

export const computeIsCommandExecuting = (isLast: boolean, lastModifiedMessage: Notification | undefined): boolean =>
	!!(isLast && lastModifiedMessage?.ask === "command" && lastModifiedMessage?.text?.includes(COMMAND_OUTPUT_STRING))

export const computeIsMcpServerResponding = (isLast: boolean, lastModifiedMessage: Notification | undefined): boolean =>
	!!(isLast && lastModifiedMessage?.say === "mcp_server_request_started")

export const computeType = (message: Notification): string =>
	message.type === "ask" ? (message.ask ?? "") : (message.say ?? "")
