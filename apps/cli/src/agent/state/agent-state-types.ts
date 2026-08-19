import type { Notification, NotificationAsk } from "@jabberwock/types"

/**
 * Agent Loop State Enum
 *
 * The possible states of the agent loop.
 */
export enum AgentLoopState {
	NO_TASK = "no_task",
	RUNNING = "running",
	STREAMING = "streaming",
	WAITING_FOR_INPUT = "waiting_for_input",
	IDLE = "idle",
	RESUMABLE = "resumable",
}

/**
 * What action the user should/can take in the current state.
 */
export type RequiredAction =
	| "none"
	| "approve"
	| "answer"
	| "retry_or_new_task"
	| "proceed_or_new_task"
	| "start_task"
	| "resume_or_abandon"
	| "start_new_task"
	| "continue_or_abort"

/**
 * Detailed information about the current agent state.
 */
export interface AgentStateInfo {
	state: AgentLoopState
	isWaitingForInput: boolean
	isRunning: boolean
	isStreaming: boolean
	currentAsk?: NotificationAsk
	requiredAction: RequiredAction
	lastMessageTs?: number
	lastMessage?: Notification
	description: string
}
