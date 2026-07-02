import type { AgentStateInfo } from "../state/agent-state-types.js"

/**
 * Helper to determine if a state change is "significant".
 *
 * A significant change is when the AgentLoopState enum value changes,
 * as opposed to just internal state updates within the same state.
 */
export function isSignificantStateChange(previous: AgentStateInfo, current: AgentStateInfo): boolean {
	return previous.state !== current.state
}

/**
 * Helper to determine if we transitioned to waiting for input.
 */
export function transitionedToWaiting(previous: AgentStateInfo, current: AgentStateInfo): boolean {
	return !previous.isWaitingForInput && current.isWaitingForInput
}

/**
 * Helper to determine if we transitioned from waiting to running.
 */
export function transitionedToRunning(previous: AgentStateInfo, current: AgentStateInfo): boolean {
	return previous.isWaitingForInput && !current.isWaitingForInput && current.isRunning
}

/**
 * Helper to determine if streaming started.
 */
export function streamingStarted(previous: AgentStateInfo, current: AgentStateInfo): boolean {
	return !previous.isStreaming && current.isStreaming
}

/**
 * Helper to determine if streaming ended.
 */
export function streamingEnded(previous: AgentStateInfo, current: AgentStateInfo): boolean {
	return previous.isStreaming && !current.isStreaming
}

/**
 * Helper to determine if task completed.
 */
export function taskCompleted(previous: AgentStateInfo, current: AgentStateInfo): boolean {
	const completionAsks = ["completion_result", "resume_completed_task"]
	const wasNotComplete = !previous.currentAsk || !completionAsks.includes(previous.currentAsk)
	const isNowComplete = current.currentAsk !== undefined && completionAsks.includes(current.currentAsk)
	return wasNotComplete && isNowComplete
}
