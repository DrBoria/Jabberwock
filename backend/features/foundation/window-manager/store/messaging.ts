import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import { hasConnector, getConnector } from "@features/foundation/webview/providerRegistry"
import type { IWindowManagerModel, WebviewStatePayload } from "@features/foundation/window-manager/store"
import { PUSH_DEBOUNCE_MS } from "@features/foundation/window-manager/store"
import { getWindowManagerState, buildEnrichedState, logStateMessages } from "./state-utils"
import { getHostEnvironment, getHostContext } from "@features/foundation/host-context/context"
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

/**
 * v4 B2 (plan §10.2): outbound delivery now routes through the active IBackendConnector —
 * in extension mode that is a wrapper over exactly this webview postMessage channel, so behavior
 * is byte-identical to before; server mode will deliver over WS without touching any call site.
 */
export function sendViaView(
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

export function postMessageToWebview(
	provider: ProviderHandle,
	message: WebviewOutboundMessage | { [key: string]: unknown },
): boolean {
	if (hasConnector()) {
		getConnector().sendOutbound(message as { type: string; [key: string]: unknown })
		return true
	}
	// Fallback for early startup before the connector is registered — identical delivery path.
	return sendViaView(provider, message)
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
			const currentConfigName = getHostEnvironment().getGlobalState<string>("currentApiConfigName")
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

		const currentConfigName = getHostEnvironment().getGlobalState<string>("currentApiConfigName")
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

export async function refreshWorkspace(_provider: ProviderHandle): Promise<void> {
	// v4 D4d (plan §3.2 Strategy D, file #3): window reload is a host command — route through the
	// host-context capability slot instead of importing "vscode" directly (purity rule G6).
	// Server mode has no hostCommands slot, so the reload is a no-op there.
	getHostContext()?.hostCommands?.reloadWindow?.()
}

function getBackendRootStoreForProvider(): { foundation: { windowManager: IWindowManagerModel } } {
	return getBackendRootStore() as { foundation: { windowManager: IWindowManagerModel } }
}
