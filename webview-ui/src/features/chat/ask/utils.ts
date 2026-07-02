import type { Notification } from "@jabberwock/types"
import { findLast } from "@shared/array"

export function hasOrphanApiRequest(messages: Notification[]): boolean {
	const lastApiReqStarted = findLast(messages, (message: Notification) => message.say === "api_req_started")
	if (!lastApiReqStarted || lastApiReqStarted.text === null || lastApiReqStarted.text === undefined) return false
	try {
		return JSON.parse(lastApiReqStarted.text).cost === undefined
	} catch {
		return true
	}
}

export function isToolCurrentlyAsking(
	messages: Notification[],
	currentAsk: string,
	enableButtons: boolean,
	primaryButtonText: string,
): boolean {
	const isLastAsk = !!messages.at(-1)?.ask
	if (!isLastAsk || currentAsk === "") return false
	return (enableButtons && primaryButtonText !== "") || currentAsk === "interactive_app"
}

export function computeIsStreaming(
	modifiedMessages: Notification[],
	currentAsk: string,
	enableButtons: boolean,
	primaryButtonText: string,
	currentTaskItem: { parentTaskId?: string } | undefined,
): boolean {
	if (!currentTaskItem) return false
	if (hasOrphanApiRequest(modifiedMessages)) return true
	if (isToolCurrentlyAsking(modifiedMessages, currentAsk, enableButtons, primaryButtonText)) return false
	return modifiedMessages.at(-1)?.partial === true
}
