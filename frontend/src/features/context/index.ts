// Public API for the Context (ICG-D1) display feature.
// Pure re-exports only (enforced by local/no-logic-in-index).

export { ContextViewportStore, type IContextViewportStore } from "./store"
export {
	contextViewportStore,
	subscribeContextStore,
	requestTaskHistory,
	requestViewportRange,
} from "./store-singleton"
export { requestHistoryRange, recallNode, type HistoryRangeRequestOptions, type RecallNodeOptions } from "./actions"
export { Timeline, type TimelineProps } from "./components/Timeline"
export { TimelineRow, type TimelineRowProps } from "./components/TimelineRow"
export { JumpControls, type JumpControlsProps } from "./components/JumpControls"
export { ThinkingPanel, type ThinkingPanelProps } from "./components/ThinkingPanel"
