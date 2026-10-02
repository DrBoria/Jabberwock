export { initFoundationState, FoundationModel } from "./store"
// ─── no-deep debt: deep-target re-exports via top barrel ─────────────
export { getUiDialogs, log } from "./capabilities/index"
export { getHostContext, getHostEnvironment } from "./host-context/context"
export {
	reportInvalidDiffError,
	reportMergeConflictError,
	reportLineMarkerInReplaceError,
} from "./time-machine/strategies/multiSearchReplace/errors"
export {
	sendCurrentCheckpointUpdated,
	sendCheckpointInitWarning,
} from "./time-machine/events/actions/sendCheckpointEvent"
export { checkContextWindowExceededError } from "./time-machine/file-context/context-error-handling"
export { EventBridge, sideBarId, tabPanelId, getFirstAvailableInstance } from "./webview/EventBridge"
export type { ProviderHandle } from "./webview/EventBridge"
export { onWebviewMessage } from "./webview/events/handlers/on-webview-message"
export { healthcheck } from "./window-manager/actions/ready"
export { postMessageToWebview, postStateToWebview } from "./window-manager/index"
export {
	WINDOW_MANAGER_SHOW_TASK_WITH_ID,
	WINDOW_MANAGER_FOCUS_PANEL_REQUEST,
	WINDOW_MANAGER_SWITCH_TAB,
	WINDOW_MANAGER_ACTIVE_PAGE_RESPONSE,
	WINDOW_MANAGER_REQUEST_STATE,
	WINDOW_MANAGER_GET_TASK_WITH_AGGREGATED_COSTS,
	WINDOW_MANAGER_DELETE_TASK_WITH_ID,
	WINDOW_MANAGER_EXPORT_TASK_WITH_ID,
	WINDOW_MANAGER_EXPORT_CURRENT_TASK,
	WINDOW_MANAGER_DELETE_MULTIPLE_TASKS_WITH_IDS,
} from "./window-manager/events/constants"
export { registerAllFoundationHandlers } from "./window-manager/handlers/index"
export {
	getBackendCapabilities,
	getClipboard,
	getConfiguration,
	getDiagnostics,
	getFileWatchers,
	getHostEditorService,
	getHostModels,
	getHostTerminalService,
	getHostThemeService,
	getTabGroups,
	setBackendCapabilities,
} from "./capabilities/registry"
export { setBackendLogger } from "./capabilities/backend-logger"
export { getWorkspaceRoot, getWorkspaceRoots, installBackendState } from "./host-context/context"
export type { IExtensionContextView, ISecretsView } from "./host-context/context"
export { getWindowManagerState, getWorkspaceTracker, resolveActivePageRequest } from "./window-manager/lib/window-utils"
export { handleModeSwitch } from "./window-manager/lib/mode-utils"
export { postStateToWebviewWithoutMessages } from "./window-manager/lib/messaging"
export { webviewMessageHandler } from "./webview/events/handlers/on-webview-message"
export type { WebviewStatePayload } from "./window-manager/store"
export { setHostContext } from "./host-context/context"
// ─── no-deep debt: deep-target re-exports via top barrel ─────────────
export { publishNotificationError } from "./capabilities/notifications"
export { EventEmitter } from "./events/event-emitter"
export { VirtualWorkspace, isVirtualWorkspace, virtualWorkspace } from "./time-machine/VirtualWorkspace"
export { checkpointDiff, checkpointRestore, checkpointSave } from "./time-machine/actions/handleCheckpoints"
export {
	computeDiffStats,
	convertNewFileToUnifiedDiff,
	sanitizeUnifiedDiff,
} from "./time-machine/actions/computeDiffStats"
export { MultiSearchReplaceDiffStrategy } from "./time-machine/strategies/multiSearchReplace/main"
export { FileContextTracker } from "./time-machine/file-context/tracker"
export type { RecordSource } from "./time-machine/file-context/tracker"
export { registerOnContextManagementIntents } from "./time-machine/file-context/events/handlers/register-on-context-management-intents"
export { askClaimTracker } from "./webview/ask-claims"
export { drainQueueToResolver, wireInboundToQueue } from "./webview/inbound-wiring"
export { registerOnWindowManagerIntents } from "./window-manager/events/handlers"

// S4: completed barrel re-exports (no-deep-feature-import)
export { onWorkspaceFoldersChanged } from "./host-context/context"
// S4: completed barrel re-exports (no-deep-feature-import)
export { getVirtualWorkspace } from "./time-machine/actions/getTimeMachine"
// S4: completed barrel re-exports (no-deep-feature-import)
export { getBackendLogger } from "./capabilities/registry"
