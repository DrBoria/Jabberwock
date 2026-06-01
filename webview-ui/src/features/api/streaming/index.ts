/**
 * Frontend api/streaming/ sub-feature — barrel exports.
 *
 * This is a NON-STANDARD sub-feature (no events/ folder).
 * See plans/architectural-restructure-v2.md §Streaming Architecture.
 */
export { StreamingStore, streamingStore } from "./store"
export type { StreamingState } from "./store"
export { useStreamingStore } from "./hooks/useStreamingStore"
