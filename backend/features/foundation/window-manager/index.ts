/**
 * window-manager feature barrel — the public API surface of the window-manager feature.
 *
 * v4: deep imports (`@features/foundation/window-manager/store`, `.../store/messaging`, ...)
 * are forbidden (no-deep); consumers import from "the" feature root. The feature store (WindowManagerModel) is exposed for composition into the parent
 * FoundationModel; UI-messaging helpers, state helpers and the shared state types are also part of
 * the public surface. The model + types live in ./store (the feature store); the
 * helper modules live in ./lib.
 */

export { WindowManagerModel } from "./store"
export type { IWindowManagerModel, WorkspaceStoreData, WebviewStatePayload, WindowManagerState } from "./store"

export {
	initWindowManagerState,
	getWindowManagerState,
	getWorkspaceTracker,
	resolveActivePageRequest,
} from "./lib/window-utils"

export {
	scheduleStatePush,
	postMessageToWebview,
	postStateToWebview,
	postStateToWebviewWithoutMessages,
} from "./lib/messaging"
export type { WebviewOutboundMessage } from "./lib/messaging"

export { handleModeSwitch } from "./lib/mode-utils"
