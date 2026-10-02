/**
 * API feature — barrel exports.
 *
 * Wraps src/api/providers/ + src/api/transform/ with intent-based orchestration.
 * All helpers from "actions/agent/" are migrated here.
 */
export { ApiModel } from "./store"
export type { IApiModel } from "./store"
export { StreamingStoreModel, StreamingModel } from "./streamingstore/store"
export type { IStreamingModel } from "./streamingstore/store"
export { apiEventConstants } from "./events"
export type { ApiEventKey } from "./events"
export { sendStreamChunk } from "./events/actions"
export {
	dispatchTaskNewIntent,
	dispatchTaskCancelIntent,
	dispatchTaskResumeIntent,
	dispatchSendMessageToAgent,
} from "./events/actions/dispatchTaskCommandIntents"
export { registerApiHandlers } from "./handlers"
export { requestApi } from "./actions/requestApi"
// ─── no-deep debt: deep-target re-exports via top barrel ─────────────
export { sendCondenseTaskContextResponse, sendCondenseTaskContextStarted } from "./events/actions/sendCondenseEvent"
export { createAttemptApiRequest } from "./handlers/request/prepare/attemptApiRequest"
export { prepareApiRequest } from "./handlers/request/prepare/main"
export type { ApiRequestContext } from "./handlers/request/prepare/main"
export { computeRateLimitRemaining } from "./handlers/request/prepare/rateLimit"
export { handleStream } from "./handlers/request/process/handleStream"
export { RawChunkTracker } from "./handlers/request/process/rawChunkProcessor"
export { pushToolResultToUserContent } from "./handlers/request/process/streaming"
export {
	handleToolCallDeltaEvent,
	handleToolCallEndEvent,
	handleToolCallStartEvent,
} from "./handlers/request/process/toolCallHandlers"
export {
	abortStream,
	createAbortPromise,
	createFirstChunkTimeoutPromise,
	drainStreamInBackground,
	resetStreamingState,
} from "./handlers/request/recover/requestAbortManager"
export { updateApiReqMsg } from "./handlers/stream/on-stream-chunk-received"
export { handleStreamError } from "./handlers/stream/error"
export { runStreamLoop } from "./handlers/stream/streamRunner"
export { toStreamHandle } from "./handlers/stream/types"
export type { StreamResult, TokenState } from "./handlers/stream/types"
export type { ChunkHandlerCallbacks } from "./handlers/stream/on-stream-chunk-received"
