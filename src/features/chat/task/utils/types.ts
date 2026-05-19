import type { EventBridge } from "../../../../core/webview/EventBridge"

/**
 * TaskDelegate exposes the surface of the Task class that is accessed
 * via unsafe inline type assertions (as unknown as { ... }) in utility files.
 *
 * Using a single interface consolidates all scattered inline casts,
 * making it easier to eventually type the Task class properly.
 */
export interface TaskDelegate {
	// ── Private methods (accessed via casts in mainLoop.ts) ──────────────
	addToApiConversationHistory(msg: Record<string, unknown>): Promise<void>
	saveClineMessages(): Promise<void>
	attemptApiRequest(retryAttempt: number, opts: Record<string, unknown>): AsyncIterable<Record<string, unknown>>
	backoffAndAnnounce(retryAttempt: number, error: unknown): Promise<void>
	updateClineMessage(msg: Record<string, unknown>): Promise<void>

	// ── Properties (accessed via as unknown / as { ... } casts) ──────────
	assistantMessageContent: Array<Record<string, unknown>>
	apiConversationHistory: Array<Record<string, unknown>>
	clineMessages: Array<Record<string, unknown>>
	cachedStreamingModel?: Record<string, unknown>
	apiConfiguration: Record<string, unknown>

	// ── Nested accessor properties ──────────────────────────────────────
	api: { getModel: () => Record<string, unknown> }
	providerRef: WeakRef<EventBridge>
	diffViewProvider: { reset: () => Promise<void> }

	// ── Properties with type-narrowing casts ────────────────────────────
	abortTask: () => Promise<void>
	maybeWaitForProviderRateLimit: (retryAttempt: number) => Promise<void>
	streamingToolCallIndices: Map<string, number>
}
