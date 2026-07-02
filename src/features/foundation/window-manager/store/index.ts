export { WindowManagerModel, PUSH_DEBOUNCE_MS } from "@features/foundation/window-manager/store"

export type {
	IWindowManagerModel,
	WorkspaceStoreData,
	WebviewStatePayload,
	WindowManagerState,
} from "@features/foundation/window-manager/store"

export {
	initWindowManagerState,
	getWindowManagerState,
	getWorkspaceTracker,
	resolveActivePageRequest,
} from "./state-utils"

export { resolveWebviewView } from "./webview-setup"
export type { WebviewMessageHandler } from "./webview-setup"

export {
	scheduleStatePush,
	postMessageToWebview,
	postStateToWebview,
	postStateToWebviewWithoutMessages,
	postStateToWebviewWithoutTaskHistory,
	refreshWorkspace,
} from "./messaging"

export type { WebviewOutboundMessage } from "./messaging"

export { handleModeSwitch } from "./mode-utils"
