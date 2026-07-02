/**
 * API handler helpers — migrated from actions/agent/.
 *
 * Organized into semantic subfolders:
 *   prepare/   — Pre-request setup (rate limiting, request building)
 *   process/   — Stream chunk processing
 *   recover/   — Post-failure recovery (backoff, context window, abort)
 */
export { handleStream } from "./process/handleStream"
export { RawChunkTracker, type ToolCallStreamEvent } from "./process/rawChunkProcessor"
export { pushToolResultToUserContent } from "./process/streaming"
export { backoffAndAnnounce } from "./recover/backoff"
export { handleContextWindowExceededError, MAX_CONTEXT_WINDOW_RETRIES } from "./recover/contextWindow"
export {
	createAbortPromise,
	createFirstChunkTimeoutPromise,
	abortStream,
	resetStreamingState,
	drainStreamInBackground,
} from "./recover/requestAbortManager"
export { mergeConsecutiveApiMessages } from "./prepare/mergeConsecutiveApiMessages"
export { prepareApiRequest, type ApiRequestContext } from "./prepare/prepareApiRequest"
export { computeRateLimitRemaining, maybeWaitForProviderRateLimit } from "./prepare/rateLimit"
