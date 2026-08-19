import { Notification, NotificationAsk } from "@jabberwock/types"

import { AgentLoopState } from "./agent-state-types.js"
import type { RequiredAction } from "./agent-state-types.js"

/**
 * Structure of the text field in api_req_started messages.
 */
export interface ApiReqStartedText {
	cost?: number
	tokensIn?: number
	tokensOut?: number
	cacheWrites?: number
	cacheReads?: number
}

/**
 * Check if an API request is still in progress (streaming).
 */
export function isApiRequestInProgress(messages: Notification[]): boolean {
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i]

		if (!message) {
			continue
		}

		if (message.say === "api_req_started") {
			if (!message.text) {
				return true
			}

			try {
				const data: ApiReqStartedText = JSON.parse(message.text)
				return data.cost === undefined
			} catch {
				return false
			}
		}
	}
	return false
}

/**
 * Determine the required action based on the current ask type.
 */
export function getRequiredAction(ask: NotificationAsk): RequiredAction {
	const actionMap: Partial<Record<NotificationAsk, RequiredAction>> = {
		followup: "answer",
		command: "approve",
		tool: "approve",
		use_mcp_server: "approve",
		command_output: "continue_or_abort",
		api_req_failed: "retry_or_new_task",
		mistake_limit_reached: "proceed_or_new_task",
		completion_result: "start_task",
		resume_task: "resume_or_abandon",
		resume_completed_task: "start_new_task",
		auto_approval_max_req_reached: "start_new_task",
	}
	return actionMap[ask] ?? "none"
}

/**
 * Get a human-readable description for the current state.
 */
export function getStateDescription(state: AgentLoopState, ask?: NotificationAsk): string {
	const askDescriptions: Partial<Record<NotificationAsk, string>> = {
		followup: "Agent is asking a follow-up question. Please provide an answer.",
		command: "Agent wants to execute a command. Approve or reject.",
		tool: "Agent wants to perform a file operation. Approve or reject.",
		use_mcp_server: "Agent wants to use an MCP server. Approve or reject.",
		completion_result: "Task completed successfully. You can provide feedback or start a new task.",
		api_req_failed: "API request failed. You can retry or start a new task.",
		mistake_limit_reached: "Too many errors encountered. You can proceed anyway or start a new task.",
		auto_approval_max_req_reached: "Auto-approval limit reached. Manual approval required.",
		resume_completed_task: "Previously completed task. Start a new task to continue.",
	}
	const descriptions: Record<AgentLoopState, string> = {
		[AgentLoopState.NO_TASK]: "No active task. Ready to start a new task.",
		[AgentLoopState.RUNNING]: "Agent is actively processing.",
		[AgentLoopState.STREAMING]: "Agent is streaming a response.",
		[AgentLoopState.WAITING_FOR_INPUT]: ask
			? (askDescriptions[ask] ?? "Agent is waiting for user input.")
			: "Agent is waiting for user input.",
		[AgentLoopState.IDLE]: ask ? (askDescriptions[ask] ?? "Task is idle.") : "Task is idle.",
		[AgentLoopState.RESUMABLE]: "Task is paused. You can resume or start a new task.",
	}
	return descriptions[state] ?? "Unknown state."
}
