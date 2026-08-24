import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import * as vscode from "vscode"
import { getWindowManagerState, postStateToWebview } from "@features/foundation/window-manager/store"
import { Package } from "@shared/package"
import { getSettingsAccess } from "@utils/settings"
import { diagnosticsManager } from "@jabberwock/devtool"

/**
 * Register all webview/devtool settings intent handlers.
 */
export function registerOnSettingsWebview(bus: IntentBus): void {
	// ── devtoolStatus ─────────────────────────────────────────────────
	bus.register(IntentType.SettingsDevtoolStatus, async () => {
		const config = vscode.workspace.getConfiguration(Package.name)
		const current = config.get<boolean>("devtool", false)
		await config.update("devtool", !current, vscode.ConfigurationTarget.Global)
	})

	// ── webviewLog ────────────────────────────────────────────────────
	bus.register(IntentType.SettingsWebviewLog, async (intent) => {
		const payload = intent.payload as { text: string }
		diagnosticsManager.log(payload.text || "")
	})

	// ── domResponse ───────────────────────────────────────────────────
	bus.register(IntentType.SettingsWebviewDomResponse, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { requestId: string; text: string }

		if (payload.requestId) {
			console.log(
				`[DEBUG: DOM] Extension: Received domResponse for ${payload.requestId} (text: ${(payload.text || "").length} chars)`,
			)
			const pendingRequests = getWindowManagerState(provider)?.pendingDomRequests
			if (pendingRequests) {
				console.log(
					`[DEBUG: DOM] pendingDomRequests size before resolve: ${pendingRequests.size}, has requestId: ${pendingRequests.has(payload.requestId)}`,
				)
			} else {
				console.log(`[DEBUG: DOM] CRITICAL: pendingDomRequests is undefined on WindowManagerState!`)
			}
			getWindowManagerState(provider)
				.pendingDomRequests.get(payload.requestId)
				?.callback(payload.text || "")
		} else {
			console.log(`[DEBUG: DOM] Extension: Received invalid domResponse (missing requestId)`)
		}
	})

	// ── webviewError ──────────────────────────────────────────────────
	bus.register(IntentType.SettingsWebviewError, async (intent) => {
		const payload = intent.payload as { text: string }
		if (payload.text) {
			diagnosticsManager.log(`[WEBVIEW_ERROR] ${payload.text}`, "error")
			vscode.window.showErrorMessage(`Webview Error: ${payload.text}`)
		}
	})

	/**
	 * Handles fetchUrl requests from the webview DevTools.
	 * The webview's browser `fetch()` is blocked by CORS for cross-origin URLs,
	 * but the extension host (Node.js) has no CORS restrictions.
	 * We fetch the URL here and return the HTML content back to the webview.
	 */
	// ── fetchUrl ──────────────────────────────────────────────────────
	bus.register(IntentType.SettingsWebviewUrlFetch, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { url: string; requestId: string }
		const url = payload.url
		const requestId = payload.requestId
		if (!url || !requestId) return

		try {
			const response = await fetch(url)
			const html = await response.text()
			await provider.postMessageToWebview({
				type: "fetchUrlResponse",
				requestId,
				text: html,
			})
		} catch (err) {
			await provider.postMessageToWebview({
				type: "fetchUrlResponse",
				requestId,
				text: "",
				error: `fetchUrl error: ${err instanceof Error ? err.message : String(err)}`,
			})
		}
	})

	// ── LOCATOR_OPEN_FILE ─────────────────────────────────────────────
	bus.register(IntentType.SettingsLocatorFileOpen, async (intent) => {
		const payload = intent.payload as {
			locatorPayload: { filePath: string; line: number; column: number }
		}
		const locatorPayload = payload.locatorPayload
		if (locatorPayload) {
			const { filePath, line, column } = locatorPayload
			const globalSettings = getSettingsAccess().getValues() as { [key: string]: unknown }
			const locatorPrefix =
				globalSettings.locatorTarget && String(globalSettings.locatorTarget).trim() !== ""
					? String(globalSettings.locatorTarget)
					: "code"

			console.log(
				`[LOCATOR] Editor open requested for ${filePath} at ${line}:${column} using prefix ${locatorPrefix}`,
			)
			try {
				const targetLine = isNaN(line) ? 1 : line
				const targetColumn = isNaN(column) ? 1 : column

				const uriString = `${locatorPrefix}://file${filePath}:${targetLine}:${targetColumn}`
				const uri = vscode.Uri.parse(uriString)

				await vscode.env.openExternal(uri)
			} catch (error) {
				console.error("[jabberwock] LocatorJS Bridge Error:", error)
				vscode.window.showErrorMessage(
					`LocatorJS: Failed to open file using protocol ${locatorPrefix}: ${error}`,
				)
			}
		}
	})

	// ── locatorTarget ─────────────────────────────────────────────────
	bus.register(IntentType.SettingsLocatorTargetSet, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { text: string }
		if (payload.text) {
			await getSettingsAccess().setValue("locatorTarget", payload.text)
			await postStateToWebview(provider)
		}
	})
}
