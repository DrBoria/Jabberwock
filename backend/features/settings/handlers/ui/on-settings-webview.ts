import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents"
import { getWindowManagerState, postStateToWebview } from "@features/foundation"

import { Package } from "@shared/core/package"

import { getSettingsAccess } from "@utils/settings"

import { diagnosticsManager } from "@jabberwock/devtool"

import { getConfiguration } from "@features/foundation"

import { getHostContext } from "@features/foundation"

import { sendFetchUrlResponse } from "@features/settings"

import { publishNotificationError } from "@features/foundation"

/**
 * Register all webview/devtool settings intent handlers.
 */

function registerOnSettingsWebviewSettingsDevtoolStatus(bus: IntentBus): void {
	bus.register(IntentType.SettingsDevtoolStatus, async () => {
		// D4g-2 (batch 3): config read/write via the capability slot (D4b).
		const current = getConfiguration().get<boolean>(Package.name, "devtool", false) ?? false
		await getConfiguration().update(Package.name, "devtool", !current)
	})
}

function registerOnSettingsWebviewSettingsWebviewLog(bus: IntentBus): void {
	bus.register(IntentType.SettingsWebviewLog, async (intent) => {
		const payload = intent.payload as { text: string }
		diagnosticsManager.log(payload.text || "")
	})
}

function registerOnSettingsWebviewSettingsWebviewDomResponse(bus: IntentBus): void {
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
}

function registerOnSettingsWebviewSettingsWebviewError(bus: IntentBus): void {
	bus.register(IntentType.SettingsWebviewError, async (intent) => {
		const payload = intent.payload as { text: string }
		if (payload.text) {
			diagnosticsManager.log(`[WEBVIEW_ERROR] ${payload.text}`, "error")
			publishNotificationError(`Webview Error: ${payload.text}`)
		}
	})
}

function registerOnSettingsWebviewSettingsWebviewUrlFetch(bus: IntentBus): void {
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
			await sendFetchUrlResponse(provider, { requestId, text: html })
		} catch (err) {
			await sendFetchUrlResponse(provider, {
				requestId,
				text: "",
				error: `fetchUrl error: ${err instanceof Error ? err.message : String(err)}`,
			})
		}
	})
}

function registerOnSettingsWebviewSettingsLocatorFileOpen(bus: IntentBus): void {
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
				// D4g-2 (batch 3): open the locator URI via the hostCommands slot (D4g-pre) — the
				// vscode connector parses the string into a host URI; server mode has no host, so
				// this degrades to a no-op.
				getHostContext()?.hostCommands?.openExternal?.(uriString)
			} catch (error) {
				console.error("[jabberwock] LocatorJS Bridge Error:", error)
				publishNotificationError(`LocatorJS: Failed to open file using protocol ${locatorPrefix}: ${error}`)
			}
		}
	})
}

function registerOnSettingsWebviewSettingsLocatorTargetSet(bus: IntentBus): void {
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

export function registerOnSettingsWebview(_bus: IntentBus): void {
	registerOnSettingsWebviewSettingsDevtoolStatus(_bus)
	registerOnSettingsWebviewSettingsWebviewLog(_bus)
	registerOnSettingsWebviewSettingsWebviewDomResponse(_bus)
	registerOnSettingsWebviewSettingsWebviewError(_bus)
	registerOnSettingsWebviewSettingsWebviewUrlFetch(_bus)
	registerOnSettingsWebviewSettingsLocatorFileOpen(_bus)
	registerOnSettingsWebviewSettingsLocatorTargetSet(_bus)
}
