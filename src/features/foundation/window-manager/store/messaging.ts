import * as vscode from "vscode"
import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import type { IWindowManagerModel, WebviewStatePayload } from "@features/foundation/window-manager/store"
import { PUSH_DEBOUNCE_MS } from "@features/foundation/window-manager/store"
import { getWindowManagerState, buildEnrichedState, logStateMessages } from "./state-utils"
import { getVscodeContext } from "@features/foundation/vscode/context"
import { getSettingsAccess } from "@utils/settings"
import { getProviderSettingsManager } from "@features/settings/models/provider-settings-manager/ProviderSettingsManager"
import { getBackendRootStore } from "@features/storeSingleton"

export function scheduleStatePush(provider: ProviderHandle, state?: WebviewStatePayload): void {
	const rootStore = getBackendRootStoreForProvider()
	const stateModel = rootStore.foundation.windowManager as IWindowManagerModel
	stateModel.scheduleStatePush(() => {
		postStateToWebview(provider, state)
	}, PUSH_DEBOUNCE_MS)
}

export type WebviewOutboundMessage =
	| { type: "state"; state: { [key: string]: unknown } & { _hydration: true } }
	| { type: "action"; action: string }
	| { type: "theme"; text: string }
	| { type: "invoke"; invoke: string }
	| { type: "mcpServers"; mcpServers: unknown }
	| { type: "listApiConfig"; listApiConfig: unknown }
	| { type: "taskHistoryUpdated"; taskHistory: unknown }
	| { type: string; [key: string]: unknown }

export function postMessageToWebview(
	provider: ProviderHandle,
	message: WebviewOutboundMessage | { [key: string]: unknown },
): boolean {
	const state = getWindowManagerState(provider)
	if (state.view) {
		state.view.webview.postMessage(message)
		return true
	}
	console.warn(`[jabberwock] [DEBUG:POSTMSG] postMessageToWebview SKIPPED - no provider.view! type=${message.type}`)
	return false
}

export async function postStateToWebview(
	provider: ProviderHandle,
	additionalState?: WebviewStatePayload,
): Promise<void> {
	const state = getWindowManagerState(provider)
	console.log(
		`[jabberwock] [DEBUG:POSTSTATE] ENTERED postStateToWebview, has state.view=${!!state.view}, additionalState keys=${Object.keys(additionalState ?? {}).join(",") || "(empty)"}`,
	)

	const enrichedState = buildEnrichedState(additionalState)
	if (Object.keys(enrichedState).length === 0) {
		return
	}

	logStateMessages(enrichedState)

	if (state.view) {
		console.log(`[jabberwock] [DEBUG:POSTSTATE] SENDING state with keys:`, Object.keys(enrichedState))
		await provider.postMessageToWebview({ type: "state", state: enrichedState })
		console.log(`[jabberwock] [DEBUG:POSTSTATE] postMessageToWebview completed`)
	} else {
		console.warn(`[jabberwock] [DEBUG:POSTMSG] postStateToWebview SKIPPED - no provider.view!`)
	}
}

export async function postStateToWebviewWithoutMessages(provider: ProviderHandle): Promise<void> {
	const state: WebviewStatePayload = {}
	try {
		const psm = getProviderSettingsManager()
		if (psm) {
			state.listApiConfigMeta = await psm.listConfig()
			const currentConfigName = getVscodeContext().getGlobalState<string>("currentApiConfigName")
			if (currentConfigName) {
				const profile = await psm.getProfile({ name: currentConfigName })
				if (profile) {
					const { name: _, ...apiConfig } = profile
					state.apiConfiguration = apiConfig
				}
			}
		}

		const settings = getSettingsAccess().getValues()
		if (settings) {
			Object.assign(state, settings)
		}

		const currentConfigName = getVscodeContext().getGlobalState<string>("currentApiConfigName")
		if (currentConfigName) {
			state.currentApiConfigName = currentConfigName
		}
	} catch {
		// Non-critical
	}

	await postStateToWebview(provider, Object.keys(state).length > 0 ? state : undefined)
}

export async function postStateToWebviewWithoutTaskHistory(provider: ProviderHandle): Promise<void> {
	await postStateToWebviewWithoutMessages(provider)
}

export async function refreshWorkspace(provider: ProviderHandle): Promise<void> {
	await vscode.commands.executeCommand("workbench.action.reloadWindow")
}

function getBackendRootStoreForProvider(): { foundation: { windowManager: IWindowManagerModel } } {
	return getBackendRootStore() as { foundation: { windowManager: IWindowManagerModel } }
}
