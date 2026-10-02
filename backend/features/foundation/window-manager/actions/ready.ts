import { getStore } from "@features/singleton"

/**
 * Returns whether the webview is launched and ready.
 */
export function healthcheck(): boolean {
	const state = getStore()
	return state.foundation.windowManager.viewLaunched
}
