import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import type { Notification } from "@jabberwock/types"
import type { IWindowManagerModel, WebviewStatePayload } from "@features/foundation/window-manager/store"
import { getBackendRootStore } from "@features/storeSingleton"
import { getContextWindowMeta } from "@features/context"
import { getHostEnvironment } from "@features/foundation/host-context/context"
import { jabberwockLog } from "@utils/logger"
import WorkspaceTracker from "@integrations/workspace/WorkspaceTracker"

export function initWindowManagerState(_provider: ProviderHandle): void {
	// No-op — state is initialized via MST model defaults
}

function lazyGetState(_provider: ProviderHandle): { foundation: { windowManager: IWindowManagerModel } } {
	const rootStore = getBackendRootStore()
	return rootStore as { foundation: { windowManager: IWindowManagerModel } }
}

export function getWindowManagerState(provider: ProviderHandle): IWindowManagerModel {
	return lazyGetState(provider).foundation.windowManager as IWindowManagerModel
}

export function buildEnrichedState(additionalState?: WebviewStatePayload): WebviewStatePayload {
	const enrichedState = { ...(additionalState ?? {}) }

	enrichedState._hydration = true

	// ICG-C1 (section 7.3 bounded handshake) - see enrichContextMeta: minimal per-task archive metadata only, content never enters hydrated state; heavy pages arrive via explicit range fetches once the client knows where it is. O(1) cache read at push time.
	try {
		enrichContextMeta(enrichedState)
	} catch {
		// Non-critical - archive may be disabled or still initializing; the next state post retries.
	}

	if (!enrichedState.currentApiConfigName) {
		const currentConfigName = getHostEnvironment().getGlobalState("currentApiConfigName")
		if (currentConfigName) {
			enrichedState.currentApiConfigName = currentConfigName
		}
	}

	if (!enrichedState.apiConfiguration || !enrichedState.listApiConfigMeta || enrichedState.isRunning === undefined) {
		try {
			applyStoreEnrichment(enrichedState)
		} catch {
			// Non-critical
		}
	}

	return enrichedState
}

/** ICG-C1 (ICG doc section 7.3 bounded handshake): inject minimal per-task archive metadata into hydrated state - content never included, by design; heavy pages arrive via explicit range fetches once the client knows where it is. O(1) cache read at push time. */
function enrichContextMeta(enrichedState: WebviewStatePayload): void {
	const contextMeta = getContextWindowMeta()

	if (!enrichedState.context && Object.keys(contextMeta).length > 0) {
		enrichedState.context = { tasks: contextMeta }
	}
}

function applyStoreEnrichment(enrichedState: WebviewStatePayload): void {
	const store = getBackendRootStore()
	const apiConfig = store.settings.apiConfig

	if (!enrichedState.listApiConfigMeta && apiConfig.listApiConfigMeta) {
		enrichedState.listApiConfigMeta = apiConfig.listApiConfigMeta
	}
	if (!enrichedState.apiConfiguration && apiConfig.apiProvider) {
		enrichedState.apiConfiguration = apiConfig.toProviderSettings()
	}
	if (enrichedState.isRunning === undefined) {
		enrichedState.isRunning = store.chat.isRunning
	}
}

export function logStateMessages(enrichedState: WebviewStatePayload): void {
	const messages = enrichedState.messages as Notification[] | undefined
	if (!messages || messages.length === 0) {
		return
	}

	const lastMessage = messages[messages.length - 1]
	const lastMessageType = `${lastMessage.type}:${lastMessage.say ?? lastMessage.ask ?? "unknown"}`
	jabberwockLog.log("state:messages", {
		count: messages.length,
		lastMessageType,
		hasPendingAsks: messages.some((m) => m.type === "ask"),
	})
}

export async function getWorkspaceTracker(provider: ProviderHandle): Promise<WorkspaceTracker | undefined> {
	const state = getWindowManagerState(provider)
	if (!state.workspaceTracker) {
		state.setWorkspaceTracker({ __tracker: new WorkspaceTracker(provider) })
	}
	const holder = state.workspaceTracker
	return holder && typeof holder === "object" && "__tracker" in holder
		? (holder as { __tracker: WorkspaceTracker }).__tracker
		: undefined
}

export function resolveActivePageRequest(provider: ProviderHandle, requestId: string, activePage: string) {
	const rootStore = getBackendRootStore() as { foundation: { windowManager: IWindowManagerModel } }
	const stateModel = rootStore.foundation.windowManager as IWindowManagerModel
	stateModel.resolveActivePageRequest(requestId, activePage)
}
