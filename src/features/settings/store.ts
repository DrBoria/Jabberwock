import type { EventBridge } from "../../core/webview/EventBridge"
import { getState } from "../storeSingleton"

/** Root settings state — sub-features manage their own slices */
export type SettingsRootState = object

export function initSettingsState(_provider: EventBridge): void {
	// All settings sub-models use types.optional(Model, {}) in store.ts,
	// so MST provides default values automatically. No direct mutations needed.
}

export function getSettingsState(provider: EventBridge): SettingsRootState {
	return getState(provider).settings as SettingsRootState
}
