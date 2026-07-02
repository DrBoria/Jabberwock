import type { Notification, AudioType } from "@jabberwock/types"
import type { IChatUIStore } from "../../../store"
import { getApiMetrics } from "@shared/api/getApiMetrics"
import { combineApiRequests } from "@shared/api/combineApiRequests"
import { combineCommandSequences } from "@shared/combineCommandSequences"
import { computeIsStreaming } from "./utils"
import {
	handleApiReqFailedAsk,
	handleMistakeLimitReachedAsk,
	handleFollowUpAsk,
	handleToolAsk,
	handleCommandAsk,
	handleCommandOutputAsk,
	handleUseMcpServerAsk,
	handleInteractiveAppAsk,
	handleCompletionResultAsk,
	handleResumeTaskAsk,
	handleResumeCompletedTaskAsk,
} from "./handlers"
export function processSimpleAsk(
	ui: IChatUIStore,
	lastMessage: Notification,
	isPartial: boolean,
	t: (key: string, options?: Record<string, unknown>) => string,
): AudioType | undefined {
	switch (lastMessage.ask) {
		case "api_req_failed":
			return handleApiReqFailedAsk(ui, t)
		case "mistake_limit_reached":
			return handleMistakeLimitReachedAsk(ui, t)
		case "followup":
			return handleFollowUpAsk(ui, isPartial)
		case "command":
			return handleCommandAsk(ui, isPartial, t)
		case "command_output":
			return handleCommandOutputAsk(ui, t)
		case "use_mcp_server":
			return handleUseMcpServerAsk(ui, isPartial, t)
		case "interactive_app":
			return handleInteractiveAppAsk(ui, isPartial)
		case "resume_completed_task":
			return handleResumeCompletedTaskAsk(ui, t)
		default:
			ui.setCurrentAsk(lastMessage.ask ?? "")
			ui.setEnableButtons(true)
			ui.setPrimaryButtonText(t("chat:approve.title"))
			ui.setSecondaryButtonText(t("chat:reject.title"))
			return undefined
	}
}

export function processComplexAsk(
	ui: IChatUIStore,
	lastMessage: Notification,
	isPartial: boolean,
	messageQueue: { id: string }[],
	currentTaskItem: { id?: string; parentTaskId?: string; ts?: number } | undefined,
	messages: Notification[],
	t: (key: string, options?: Record<string, unknown>) => string,
): AudioType | undefined {
	switch (lastMessage.ask) {
		case "tool":
			return handleToolAsk(ui, isPartial, lastMessage, t)
		case "completion_result":
			return handleCompletionResultAsk(ui, isPartial, messageQueue, t)
		case "resume_task":
			return handleResumeTaskAsk(ui, currentTaskItem, messages, t)
		default:
			return undefined
	}
}

export function computeAskDerivedState(
	ui: IChatUIStore,
	messages: Notification[],
	currentTaskItem: { id?: string; parentTaskId?: string; ts?: number } | undefined,
	inputValue: string,
): void {
	const modifiedMessages = combineApiRequests(combineCommandSequences(messages.slice(1)))
	ui.setIsStreaming(
		computeIsStreaming(modifiedMessages, ui.currentAsk, ui.enableButtons, ui.primaryButtonText, currentTaskItem),
	)
	ui.setIsFollowUpAutoApprovalPaused(!!(inputValue && inputValue.trim().length > 0 && ui.currentAsk === "followup"))
	ui.setApiMetrics(getApiMetrics(modifiedMessages))
}
