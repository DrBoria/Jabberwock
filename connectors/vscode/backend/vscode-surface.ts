import * as vscode from "vscode"
import * as path from "path"
import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import type { WebviewMessage } from "@jabberwock/types"
import type { IWindowManagerModel, WebviewStatePayload } from "@features/foundation/window-manager/store"
import { getWindowManagerState } from "@features/foundation/window-manager/lib/window-utils"
import { getHtmlContent, getHMRHtmlContent, getErrorHtml } from "./html-utils"
import { postStateToWebview, postMessageToWebview } from "@features/foundation/window-manager/lib/messaging"
import { getHostEnvironment } from "@features/foundation/host-context/context"
import { getProviderSettingsManager } from "@features/settings/models/provider-settings-manager"
import { getStore } from "@features/singleton"
import { setupSyncer } from "@features/foundation/window-manager/syncer"
import { getTheme } from "./integrations/theme/getTheme"
import { WEBVIEW_BUILD_DIR } from "@shared/webviewBuildDir"

export type SurfaceMessageHandler = (provider: ProviderHandle, message: WebviewMessage) => Promise<void>

export async function resolveWebviewView(
	provider: ProviderHandle,
	webviewView: vscode.WebviewView | vscode.WebviewPanel,
	messageHandler?: SurfaceMessageHandler,
) {
	const state = resolveSurfaceState(provider, webviewView)
	if (!state) return

	const webview = webviewView.webview
	configureSurfaceOptions(webview)

	const liveness = { alive: false }
	setupSurfaceMessageListener(provider, webview, state, messageHandler, liveness)
	setupSurfaceDisposalHandler(provider, webviewView, state)
	setSurfaceHtmlContent(provider, webview)

	// LIVENESS PROBE (visibility-aware): VS Code only creates the WebviewView's
	// iframe when the view is first SHOWN. While the sidebar is hidden no script
	// can run, so the probe must start on first visibility — not on resolve.
	let probeStarted = false
	const startProbeIfVisible = () => {
		if (probeStarted || !webviewView.visible) return
		probeStarted = true
		console.log(
			`[jabberwock] [VSCODE-SURFACE-VISIBLE] ${surfaceKind(webviewView)} first shown — starting liveness probe`,
		)
		startSurfaceLivenessProbe(state, webviewView, liveness)
	}
	startProbeIfVisible()
	const visibilityDisposable = webviewView.onDidChangeVisibility(startProbeIfVisible)
	state.addDisposable(visibilityDisposable)

	const initialState = await loadInitialSurfaceState(provider)
	await postStateToWebview(provider, Object.keys(initialState).length > 0 ? initialState : undefined)

	state.setViewLaunched(true)

	setupSyncerAndSubscriptions(provider, state, webviewView)
}

function surfaceKind(webviewView: vscode.WebviewView | vscode.WebviewPanel): string {
	return "onDidChangeVisibility" in webviewView ? "WebviewView" : "WebviewPanel"
}

/**
 * Watch the webview for any inbound message within a grace period. If none
 * arrives, the iframe never executed our script — i.e. VS Code's pre-load page
 * failed before delivering our HTML. Log an unambiguous diagnostic to the
 * backend console (captured by the devtool console interceptor).
 */
function startSurfaceLivenessProbe(
	state: IWindowManagerModel,
	webviewView: vscode.WebviewView | vscode.WebviewPanel,
	liveness: { alive: boolean },
): void {
	// The production bundle is large (~6.6 MB) and React boot can exceed 8 s on a
	// cold machine, so the grace period must be generous to avoid false positives.
	const graceMs = 30_000
	const timer = setTimeout(() => {
		if (liveness.alive) return
		console.error(
			`[jabberwock] [VSCODE-SURFACE-DEAD] No message received from the ${surfaceKind(webviewView)} within ${graceMs}ms after it was first shown — ` +
				`the VS Code surface may not have executed our script (HTML not delivered, CSP block, or JS error). ` +
				`Next step: check the VS Code workbench renderer console (Help > Toggle Developer Tools > Console) ` +
				`or the on-disk log ~/.config/Code/logs/<session>/window<N>/renderer.log for webview load errors.`,
		)
	}, graceMs)
	state.addDisposable({ dispose: () => clearTimeout(timer) })
}

function resolveSurfaceState(
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

function configureSurfaceOptions(webview: vscode.Webview): void {
	const extensionRoot = path.dirname(getHostEnvironment().extensionUri.fsPath)
	webview.options = {
		enableScripts: true,
		localResourceRoots: [
			vscode.Uri.file(path.join(extensionRoot, WEBVIEW_BUILD_DIR)),
			// Hero logo (jabberwock-logo.png) lives in backend/assets/images and is
			// referenced via window.IMAGES_BASE_URI (set in html-utils.ts).
			vscode.Uri.file(path.join(extensionRoot, "backend", "assets", "images")),
		],
	}
}

function setupSurfaceMessageListener(
	provider: ProviderHandle,
	webview: vscode.Webview,
	state: IWindowManagerModel,
	messageHandler?: SurfaceMessageHandler,
	liveness?: { alive: boolean },
): void {
	const handler =
		messageHandler ??
		(async (_provider, _message) => {
			console.warn(
				"[jabberwock] [resolveWebviewView] No message handler registered — messages are not being processed",
			)
		})
	const messageDisposable = webview.onDidReceiveMessage(async (message: { [key: string]: unknown }) => {
		// Any inbound message proves the iframe executed our script — mark alive
		// so the liveness probe does not fire a false positive.
		if (liveness && !liveness.alive) {
			liveness.alive = true
			console.log(`[jabberwock] [VSCODE-SURFACE-ALIVE] First inbound message received — surface is alive`)
		}
		try {
			await handler(provider, message as never as WebviewMessage)
		} catch (error) {
			console.error(
				`[jabberwock] [resolveWebviewView] Unhandled error processing message:`,
				error instanceof Error ? error.message : String(error),
			)
		}
	})
	state.addDisposable(messageDisposable)
}

function setupSurfaceDisposalHandler(
	provider: ProviderHandle,
	webviewView: vscode.WebviewView | vscode.WebviewPanel,
	state: IWindowManagerModel,
): void {
	state.addWebviewDisposable(
		webviewView.onDidDispose(() => {
			state.webviewDisposables.forEach((d) => d.dispose()) // v4 B2 (L14): protocol DisposableLike — no vscode annotation needed
			state.clearWebviewDisposables()
			if (state.view === webviewView) {
				state.setView(null)
			}
		}),
	)
}

function setSurfaceHtmlContent(provider: ProviderHandle, webview: vscode.Webview): void {
	// Dev: Vite HMR HTML when the dev server is up (falls back to the production
	// build automatically). Prod: the built SPA with nonce'd scripts + CSP meta.
	const isDev = getHostEnvironment().extensionMode === vscode.ExtensionMode.Development
	const html = isDev ? getHMRHtmlContent(provider, webview) : getHtmlContent(provider, webview)
	webview.html = html
}

async function loadInitialSurfaceState(_provider: ProviderHandle): Promise<WebviewStatePayload> {
	let initialState: WebviewStatePayload = {}
	try {
		const psm = getProviderSettingsManager()
		if (!psm) return initialState

		let currentConfigName = getHostEnvironment().getGlobalState<string>("currentApiConfigName")

		let listApiConfig: import("@jabberwock/types").ProviderSettingsEntry[] = []
		try {
			listApiConfig = await psm.listConfig()
			initialState.listApiConfigMeta = listApiConfig
		} catch {
			// Non-critical
		}

		if (!currentConfigName && listApiConfig.length > 0) {
			try {
				await getHostEnvironment().updateGlobalState("currentApiConfigName", listApiConfig[0].name)
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
	const syncerDisposer = setupSyncer(provider, getStore())
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
