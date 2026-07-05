import { Instance } from "mobx-state-tree"
import { isSecretStateKey, type JabberwockSettings } from "@jabberwock/types"
import { EventBridge } from "@features/foundation/webview/EventBridge"
import { getSettingsAccess } from "@utils/settings"
import { getProviderSettingsManager } from "./provider-settings-manager"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import type { IBackendRootStore } from "@features/store"
import { ApiConfigModel } from "./store"

export { ApiConfigModel }
export type IApiConfigModel = Instance<typeof ApiConfigModel>

// Backward-compatible types and functions
export type ApiConfigState = object

export function initApiConfigState(_provider: EventBridge): void {}

export function getApiConfigState(rootStore: IBackendRootStore): ApiConfigState {
	return rootStore.settings.apiConfig as ApiConfigState
}

/**
 * Gets the current configuration (minus secrets).
 */
export function getConfiguration(_provider: EventBridge): JabberwockSettings {
	return Object.fromEntries(
		Object.entries(getSettingsAccess().getValues()).filter(([key]) => !isSecretStateKey(key)),
	) as JabberwockSettings
}

/**
 * Sets the configuration for the current API profile.
 */
export async function setConfiguration(provider: EventBridge, values: JabberwockSettings): Promise<void> {
	await getSettingsAccess().setValues(values)
	await getProviderSettingsManager()?.saveConfig(values.currentApiConfigName || "default", values)
	await postStateToWebview(provider)
}
