import * as vscode from "vscode"
import * as path from "path"
import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import type { IWindowManagerModel, WebviewStatePayload } from "@features/foundation/window-manager/store"
import { getWindowManagerState } from "./state-utils"
import { getHtmlContent, getHMRHtmlContent, getErrorHtml } from "./html-utils"
import { postStateToWebview, postMessageToWebview } from "./messaging"
import { getVscodeContext } from "@features/foundation/vscode/context"
import { getProviderSettingsManager } from "@features/settings/models/provider-settings-manager/ProviderSettingsManager"
import { getBackendRootStore } from "@features/storeSingleton"
import { setupSyncer } from "@features/foundation/window-manager/syncer"
import { getTheme } from "@integrations/theme/getTheme"

export type WebviewMessageHandler = (provider: ProviderHandle, message: { [key: string]: unknown }) => Promise<void>

export async function resolveWebviewView(
	provider: ProviderHandle,
	webviewView: vscode.WebviewView | vscode.WebviewPanel,
	messageHandler?: WebviewMessageHandler,
) {
	const state = resolveWebviewState(provider, webviewView)
	if (!state) return

	const webview = webviewView.webview
	configureWebviewOptions(webview)

	setupWebviewMessageListener(provider, webview, state, messageHandler)
	setupWebviewDisposalHandler(provider, webviewView, state)
	setWebviewHtmlContent(provider, webview)

	const initialState = await loadInitialWebviewState(provider)
	await postStateToWebview(provider, Object.keys(initialState).length > 0 ? initialState : undefined)

	state.setViewLaunched(true)

	setupSyncerAndSubscriptions(provider, state, webviewView)
}

function resolveWebviewState(
	provider: ProviderHandle,
	webviewView: vscode.WebviewView | vscode.WebviewPanel,
): IWindowManagerModel | undefined {
	let state: IWindowManagerModel
	try {
		state = getWindowManagerState(provider)
		state.setView(webviewView)
		return state
	} catch (error) {
		const errorMessage = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error)
		console.error(`[jabberwock] [resolveWebviewView] Error:`, errorMessage)
		if (webviewView?.webview) {
			webviewView.webview.html = getErrorHtml(errorMessage)
			return undefined
		}
		throw error
	}
}

function configureWebviewOptions(webview: vscode.Webview): void {
	webview.options = {
		enableScripts: true,
		localResourceRoots: [
			vscode.Uri.file(path.join(path.dirname(getVscodeContext().extensionUri.fsPath), "webview-ui", "build")),
		],
	}
}

function setupWebviewMessageListener(
	provider: ProviderHandle,
	webview: vscode.Webview,
	state: IWindowManagerModel,
	messageHandler?: WebviewMessageHandler,
): void {
	const handler =
		messageHandler ??
		(async (_provider, _message) => {
			console.warn(
				"[jabberwock] [resolveWebviewView] No message handler registered — messages are not being processed",
			)
		})
	const messageDisposable = webview.onDidReceiveMessage(async (message: { [key: string]: unknown }) => {
		try {
			await handler(provider, message)
		} catch (error) {
			console.error(
				`[jabberwock] [resolveWebviewView] Unhandled error processing message:`,
				error instanceof Error ? error.message : String(error),
			)
		}
	})
	state.addDisposable(messageDisposable)
}

function setupWebviewDisposalHandler(
	provider: ProviderHandle,
	webviewView: vscode.WebviewView | vscode.WebviewPanel,
	state: IWindowManagerModel,
): void {
	state.addWebviewDisposable(
		webviewView.onDidDispose(() => {
			state.webviewDisposables.forEach((d: vscode.Disposable) => d.dispose())
			state.clearWebviewDisposables()
			if (state.view === webviewView) {
				state.setView(null)
			}
		}),
	)
}

function setWebviewHtmlContent(provider: ProviderHandle, webview: vscode.Webview): void {
	if (getVscodeContext().extensionMode === vscode.ExtensionMode.Development) {
		webview.html = getHMRHtmlContent(provider, webview)
	} else {
		webview.html = getHtmlContent(provider, webview)
	}
}

async function loadInitialWebviewState(provider: ProviderHandle): Promise<WebviewStatePayload> {
	let initialState: WebviewStatePayload = {}
	try {
		const psm = getProviderSettingsManager()
		if (!psm) return initialState

		let currentConfigName = getVscodeContext().getGlobalState<string>("currentApiConfigName")

		let listApiConfig: import("@jabberwock/types").ProviderSettingsEntry[] = []
		try {
			listApiConfig = await psm.listConfig()
			initialState.listApiConfigMeta = listApiConfig
		} catch {
			// Non-critical
		}

		if (!currentConfigName && listApiConfig.length > 0) {
			try {
				await getVscodeContext().updateGlobalState("currentApiConfigName", listApiConfig[0].name)
				currentConfigName = listApiConfig[0].name
			} catch {
				// Non-critical
			}
		}

		if (currentConfigName) {
			const profile = await psm.getProfile({ name: currentConfigName })
			if (profile) {
				const { name: _, ...apiConfiguration } = profile
				initialState.apiConfiguration = apiConfiguration
			}
		}
	} catch {
		// Non-critical
	}
	return initialState
}

function setupSyncerAndSubscriptions(
	provider: ProviderHandle,
	state: IWindowManagerModel,
	webviewView: vscode.WebviewView | vscode.WebviewPanel,
): void {
	const syncerDisposer = setupSyncer(provider, getBackendRootStore())
	state.addWebviewDisposable({ dispose: syncerDisposer })
	;(provider as { codeIndexManager?: { updateSubscription?: () => void } }).codeIndexManager?.updateSubscription?.()

	const activeEditorSubscription = vscode.window.onDidChangeActiveTextEditor(() => {
		;(
			provider as { codeIndexManager?: { updateSubscription?: () => void } }
		).codeIndexManager?.updateSubscription?.()
	})
	state.addWebviewDisposable(activeEditorSubscription)

	if ("onDidChangeViewState" in webviewView) {
		const viewStateDisposable = webviewView.onDidChangeViewState(() => {
			if (state.view?.visible) {
				postMessageToWebview(provider, { type: "action", action: "didBecomeVisible" })
			}
		})
		state.addWebviewDisposable(viewStateDisposable)
	} else if ("onDidChangeVisibility" in webviewView) {
		const visibilityDisposable = webviewView.onDidChangeVisibility(() => {
			if (state.view?.visible) {
				postMessageToWebview(provider, { type: "action", action: "didBecomeVisible" })
			}
		})
		state.addWebviewDisposable(visibilityDisposable)
	}

	const configDisposable = vscode.workspace.onDidChangeConfiguration(async (e) => {
		if (e.affectsConfiguration("workbench.colorTheme")) {
			await postMessageToWebview(provider, { type: "theme", text: JSON.stringify(await getTheme()) })
		}
	})
	state.addWebviewDisposable(configDisposable)
}
