/**
 * API feature — barrel exports.
 *
 * Wraps src/api/providers/ + src/api/transform/ with intent-based orchestration.
 * All helpers from actions/agent/ are migrated here.
 */
export { ApiModel, StreamingStoreModel, StreamingModel } from "./store"
export type { IApiModel, IStreamingModel } from "./store"
export { apiEventConstants } from "./events"
export type { ApiEventKey } from "./events"
export { sendStreamChunk } from "./events/actions"
export { registerApiHandlers } from "./handlers"
export { requestApi } from "./actions"
