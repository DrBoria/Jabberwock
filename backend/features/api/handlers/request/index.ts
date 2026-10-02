/**
 * API handler helpers — migrated from "actions/agent/."
 *
 * Organized into semantic subfolders:
 *   prepare/   — Pre-request setup (rate limiting, request building)
 *   process/   — Stream chunk processing
 *   recover/   — Post-failure recovery (backoff, context window, abort)
 */
export { handleStream } from "./process/handleStream.ts"
export { RawChunkTracker, type ToolCallStreamEvent } from "./process/rawChunkProcessor.ts"
export { pushToolResultToUserContent } from "./process/streaming.ts"
export { backoffAndAnnounce } from "./recover/backoff.ts"
export { handleContextWindowExceededError, MAX_CONTEXT_WINDOW_RETRIES } from "./recover/contextWindow.ts"
export {
	createAbortPromise,
	createFirstChunkTimeoutPromise,
	abortStream,
	resetStreamingState,
	drainStreamInBackground,
} from "./recover/requestAbortManager.ts"
export { mergeConsecutiveApiMessages } from "./prepare/mergeConsecutiveApiMessages.ts"
export { prepareApiRequest, type ApiRequestContext } from "./prepare/main.ts"
export { computeRateLimitRemaining, maybeWaitForProviderRateLimit } from "./prepare/rateLimit.ts"
