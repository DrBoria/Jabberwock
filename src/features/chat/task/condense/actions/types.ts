import type { Anthropic } from "@anthropic-ai/sdk"
import type { ProviderSettings } from "@jabberwock/types"
import type { ApiMessage } from "@features/chat/task/messages/actions/save/saveApiMessages.types"
import type { ITaskModel } from "@features/chat/task/store"
import type { AssistantMessageContent } from "@features/chat/task/messages/actions"

/**
 * A handle to a task model for streaming operations.
 * This is the ITaskModel instance with all volatile runtime properties attached.
 */
export type StreamHandle = ITaskModel

/**
 * Callbacks injected into attemptApiRequest to decouple it from its calling context.
 * The caller (mainLoop / handleStream) provides concrete implementations that bridge
 * to the EventBridge, Notifications, and MST store.
 */
export interface AttemptApiRequestCallbacks {
	getSystemPrompt(): Promise<string>
	getEnvironmentDetails(includeFileDetails: boolean): Promise<string>
	overwriteApiConversationHistory(messages: ApiMessage[]): Promise<void>
	buildCleanConversationHistory(
		messages: ApiMessage[],
	): Array<Anthropic.Messages.MessageParam | { role: "user" | "assistant"; content: string; reasoning?: unknown }>
	say(type: string, ...args: unknown[]): Promise<void>
	ask(type: string, data: unknown): Promise<{ response: string; text?: string; images?: string[] }>
}

/**
 * Methods and volatile properties that are set on the ITaskModel instance at runtime
 * by the task initialization flow (outside the MST store definition).
 * The cast `task as ITaskModel & TaskDelegate` makes these accessible.
 */
export interface TaskDelegate {
	attemptApiRequest(retryAttempt: number, opts: { [key: string]: unknown }): AsyncIterable<unknown>
	streamingToolCallIndices: Record<string, number>
	assistantMessageContent: AssistantMessageContent[]
	backoffAndAnnounce(retryAttempt: number, error: Error): Promise<void>
	apiConfiguration: ProviderSettings
	cachedStreamingModel?: { id: string; info: { [key: string]: unknown } } | undefined
}
