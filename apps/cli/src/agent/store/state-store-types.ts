import type { Notification, ChatMessage, ExtensionState } from "@jabberwock/types"
import type { AgentStateInfo } from "../state/agent-state-types.js"

/**
 * The complete state managed by the store.
 */
export interface StoreState {
	/**
	 * The array of messages from the extension.
	 * This is the primary data used to compute agent state.
	 */
	messages: Notification[]

	/**
	 * Optional ChatMessage array from the task context.
	 * Used alongside `messages` during the Notification → ChatMessage migration.
	 * @deprecated Eventually replaces `messages` once all consumers migrate to ChatMessage.
	 */
	chatMessages?: ChatMessage[]

	/**
	 * The computed agent state info.
	 * Updated automatically when messages change.
	 */
	agentState: AgentStateInfo

	/**
	 * Whether we have received any state from the extension.
	 * Useful to distinguish "no task" from "not yet connected".
	 */
	isInitialized: boolean

	/**
	 * The last time state was updated.
	 */
	lastUpdatedAt: number

	/**
	 * The current mode (e.g., "code", "architect", "ask").
	 * Tracked from state messages received from the extension.
	 */
	currentMode: string | undefined

	/**
	 * Optional: Cache of extension state fields we might need.
	 * This is a subset of the full ExtensionState.
	 */
	extensionState?: Partial<ExtensionState>
}
