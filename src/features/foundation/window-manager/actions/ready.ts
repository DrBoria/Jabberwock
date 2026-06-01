import { getBackendRootStore } from "@features/storeSingleton"

/**
 * Returns whether the webview is launched and ready.
 */
export function healthcheck(): boolean {
	const state = getBackendRootStore()
	return state.foundation.windowManager.viewLaunched
}
