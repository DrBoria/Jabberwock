/**
 * API handler helpers — migrated from actions/agent/.
 */
export { handleStream } from "./handleStream"
export { createChunkHandlers, updateApiReqMsg, type ChunkHandlerCallbacks } from "./streamChunkHandlers"
export { RawChunkTracker, type ToolCallStreamEvent } from "./rawChunkProcessor"
export { backoffAndAnnounce } from "./backoff"
export { handleContextWindowExceededError, MAX_CONTEXT_WINDOW_RETRIES } from "./contextWindow"
export { mergeConsecutiveApiMessages } from "./mergeConsecutiveApiMessages"
export { prepareApiRequest, type ApiRequestContext } from "./prepareApiRequest"
export { getCurrentProfileId, maybeWaitForProviderRateLimit } from "./rateLimit"
export {
	createAbortPromise,
	createFirstChunkTimeoutPromise,
	abortStream,
	resetStreamingState,
	drainStreamInBackground,
} from "./requestAbortManager"
export { pushToolResultToUserContent } from "./streaming"
