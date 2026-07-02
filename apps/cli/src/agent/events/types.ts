import { Notification, NotificationAsk } from "@jabberwock/types"

import type { AgentStateInfo } from "../state/agent-state-types.js"

/**
 * Event payload for state changes.
 */
export interface AgentStateChangeEvent {
	/** The previous state info */
	previousState: AgentStateInfo
	/** The new/current state info */
	currentState: AgentStateInfo
	/** Whether this is a significant state transition (state enum changed) */
	isSignificantChange: boolean
}

/**
 * Event payload when agent starts waiting for input.
 */
export interface WaitingForInputEvent {
	/** The specific ask type */
	ask: NotificationAsk
	/** Full state info for context */
	stateInfo: AgentStateInfo
	/** The message that triggered this wait */
	message: Notification
}

/**
 * Event payload when a task completes.
 */
export interface TaskCompletedEvent {
	/** Whether the task completed successfully */
	success: boolean
	/** The final state info */
	stateInfo: AgentStateInfo
	/** The completion message if available */
	message?: Notification
}

/**
 * Event payload when mode changes.
 */
export interface ModeChangedEvent {
	/** The previous mode (undefined if first mode set) */
	previousMode: string | undefined
	/** The new/current mode */
	currentMode: string
}

/**
 * All events that can be emitted by the client.
 *
 * Design note: We use a string literal union type for event names to ensure
 * type safety when subscribing to events. The payload type is determined by
 * the event name.
 */
export interface ClientEventMap {
	/** Emitted whenever the agent state changes. */
	stateChange: AgentStateChangeEvent

	/** Emitted when a new message is added to the message list. */
	message: Notification

	/** Emitted when an existing message is updated (e.g., partial -> complete). */
	messageUpdated: Notification

	/** Emitted when the agent starts waiting for user input. */
	waitingForInput: WaitingForInputEvent

	/** Emitted when the agent stops waiting and resumes running. */
	resumedRunning: void

	/** Emitted when the agent starts streaming content. */
	streamingStarted: void

	/** Emitted when streaming ends. */
	streamingEnded: void

	/** Emitted when a task completes (either successfully or with error). */
	taskCompleted: TaskCompletedEvent

	/** Emitted when a task is cleared/cancelled. */
	taskCleared: void

	/** Emitted when the current mode changes. */
	modeChanged: ModeChangedEvent

	/** Emitted on any error during message processing. */
	error: Error
}
