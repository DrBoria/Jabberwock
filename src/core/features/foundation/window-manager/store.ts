import { types, Instance } from "mobx-state-tree"
import * as vscode from "vscode"
import type { ExtensionMessage } from "@jabberwock/types"
import { getNonce } from "../../../webview/getNonce"
import { getUri } from "../../../webview/getUri"
import type { ClineProvider } from "../../../webview/ClineProvider"
import type { WebviewMessage } from "../../../../shared/WebviewMessage"
import { webviewMessageHandler } from "../../../webview/webviewMessageHandler"
import { MarketplaceManager } from "../../../../services/marketplace"

/**
 * A single window entry in the stack.
 */
export const WindowEntry = types.model("WindowEntry", {
	id: types.identifier,
	title: types.string,
	route: types.string,
	params: types.optional(types.frozen<Record<string, any>>(), {}),
})

/**
 * Window manager store — mirrors the webview-side window stack
 * on the extension side, enabling push/pop operations.
 */
export const WindowManagerStore = types
	.model("WindowManagerStore", {
		stack: types.array(WindowEntry),
		maxStackSize: types.optional(types.number, 20),
	})
	.views((self) => ({
		/**
		 * The currently active (top) window.
		 */
		get activeWindow() {
			if (self.stack.length === 0) return null
			return self.stack[self.stack.length - 1]
		},

		/**
		 * Whether the stack is empty.
		 */
		get isEmpty() {
			return self.stack.length === 0
		},

		/**
		 * The current stack depth.
		 */
		get depth() {
			return self.stack.length
		},

		/**
		 * Find a window entry by id.
		 */
		getWindow(id: string) {
			return self.stack.find((w) => w.id === id) ?? null
		},
	}))
	.actions((self) => ({
		/**
		 * Push a new window onto the stack.
		 */
		push(opts: { id: string; title: string; route: string; params?: Record<string, any> }) {
			if (self.stack.length >= self.maxStackSize) {
				// Remove the bottom-most window to make room
				self.stack.shift()
			}
			const entry = WindowEntry.create({
				id: opts.id,
				title: opts.title,
				route: opts.route,
				params: opts.params ?? {},
			})
			self.stack.push(entry)
		},

		/**
		 * Pop the top window from the stack.
		 * Returns the popped entry, or null if empty.
		 */
		pop(): Instance<typeof WindowEntry> | null {
			if (self.stack.length === 0) return null
			return self.stack.pop() ?? null
		},

		/**
		 * Pop windows until the stack depth reaches the target.
		 */
		popTo(depth: number) {
			while (self.stack.length > depth) {
				self.stack.pop()
			}
		},

		/**
		 * Replace the top window with a new one.
		 */
		replace(opts: { id: string; title: string; route: string; params?: Record<string, any> }) {
			if (self.stack.length > 0) {
				self.stack.pop()
			}
			this.push(opts)
		},

		/**
		 * Clear the entire stack.
		 */
		clear() {
			self.stack.clear()
		},
	}))

export function createWindowManagerStore(maxStackSize = 20) {
	return WindowManagerStore.create({ maxStackSize })
}

// ─── Webview lifecycle helpers ────────────────────────────────────────────────

/**
 * Clear all webview disposables.
 */
export function clearWebviewResources(provider: ClineProvider): void {
	const p = provider as any
	while (p.webviewDisposables.length) {
		const x = p.webviewDisposables.pop()
		if (x) {
			x.dispose()
		}
	}
}

/**
 * Post a message to the webview.
 */
export function postMessageToWebview(provider: ClineProvider, message: ExtensionMessage): void {
	const p = provider as any
	if (p._disposed) {
		return
	}

	try {
		p.view?.webview.postMessage(message)
	} catch {
		// View disposed, drop message silently
	}
}

/**
 * Request the webview DOM (used by DevTools).
 */
import { createTimerQueueStore } from "../timer-queue/store"

let _timerQueue: ReturnType<typeof createTimerQueueStore> | undefined

function getTimerQueue(): ReturnType<typeof createTimerQueueStore> {
	if (!_timerQueue) {
		_timerQueue = createTimerQueueStore()
	}
	return _timerQueue
}

export function getWebviewDom(provider: ClineProvider): Promise<string> {
	const p = provider as any
	const requestId = Math.random().toString(36).substring(7)
	console.log(`[DEBUG: DOM] Extension: Sending getDom request ${requestId}`)
	return new Promise((resolve, reject) => {
		p.pendingDomRequests.set(requestId, resolve)

		postMessageToWebview(provider, {
			type: "getDom",
			requestId,
		} as any)

		const domTimeoutId = `dom-request-${requestId}`
		getTimerQueue().schedule({
			id: domTimeoutId,
			label: "DOM request timeout",
			timeoutMs: 10000,
		})
		getTimerQueue()
			.createAbortPromise(domTimeoutId)
			.then(() => {
				if (p.pendingDomRequests.has(requestId)) {
					console.log(`[DEBUG: DOM] Extension: TIMEOUT for request ${requestId}`)
					p.pendingDomRequests.delete(requestId)
					reject(new Error(`Timeout requesting webview DOM (req: ${requestId})`))
				}
			})
	})
}

/**
 * Resolve a pending DOM request.
 */
export function resolveDomRequest(provider: ClineProvider, requestId: string, dom: string): void {
	const p = provider as any
	const resolve = p.pendingDomRequests.get(requestId)
	if (resolve) {
		resolve(dom)
		p.pendingDomRequests.delete(requestId)
	}
}

/**
 * Convert a file path to a webview-accessible URI.
 */
export function convertToWebviewUri(provider: ClineProvider, filePath: string): string {
	const p = provider as any
	try {
		const fileUri = vscode.Uri.file(filePath)

		// Check if we have a webview available
		if (p.view?.webview) {
			const webviewUri = p.view.webview.asWebviewUri(fileUri)
			return webviewUri.toString()
		}

		// Specific error for no webview available
		const error = new Error("No webview available for URI conversion")
		console.error(error.message)
		// Fallback to file URI if no webview available
		return fileUri.toString()
	} catch (error) {
		// More specific error handling
		if (error instanceof TypeError) {
			console.error("Invalid file path provided for URI conversion:", error)
		} else {
			console.error("Failed to convert to webview URI:", error)
		}
		// Return file URI as fallback
		return vscode.Uri.file(filePath).toString()
	}
}

/**
 * Get HMR (development) HTML content for the webview.
 */
export async function getHMRHtmlContent(provider: ClineProvider, webview: vscode.Webview): Promise<string> {
	const p = provider as any
	let localPort = "5173"

	try {
		const fs = require("fs")
		const path = require("path")
		const portFilePath = path.resolve(__dirname, "../../.vite-port")

		if (fs.existsSync(portFilePath)) {
			localPort = fs.readFileSync(portFilePath, "utf8").trim()
			console.log(`[ClineProvider:Vite] Using Vite server port from ${portFilePath}: ${localPort}`)
		} else {
			console.log(`[ClineProvider:Vite] Port file not found at ${portFilePath}, using default port: ${localPort}`)
		}
	} catch (err) {
		console.error("[ClineProvider:Vite] Failed to read Vite port file:", err)
	}

	const localServerUrl = `localhost:${localPort}`

	// Check if local dev server is running.
	try {
		const axios = require("axios")
		await axios.get(`http://${localServerUrl}`)
	} catch (error) {
		vscode.window.showErrorMessage("HMR dev server is not running. Please start the webview-ui dev server.")
		return getHtmlContent(provider, webview)
	}

	const nonce = getNonce()

	// Get the OpenRouter base URL from configuration
	const { getState } = await import("../../chat/task/history")
	const state = await getState(provider)
	const apiConfiguration = (state as any).apiConfiguration || {}
	const openRouterBaseUrl = apiConfiguration.openRouterBaseUrl || "https://openrouter.ai"
	// Extract the domain for CSP
	const openRouterDomain = openRouterBaseUrl.match(/^(https?:\/\/[^\/]+)/)?.[1] || "https://openrouter.ai"

	const stylesUri = getUri(webview, p.contextProxy.extensionUri, ["webview-ui", "build", "assets", "index.css"])

	const codiconsUri = getUri(webview, p.contextProxy.extensionUri, ["assets", "codicons", "codicon.css"])
	const materialIconsUri = getUri(webview, p.contextProxy.extensionUri, ["assets", "vscode-material-icons", "icons"])
	const imagesUri = getUri(webview, p.contextProxy.extensionUri, ["assets", "images"])
	const audioUri = getUri(webview, p.contextProxy.extensionUri, ["webview-ui", "audio"])

	const file = "src/index.tsx"
	const scriptUri = `http://${localServerUrl}/${file}`

	const reactRefresh = /*html*/ `
		<script nonce="${nonce}" type="module">
			import RefreshRuntime from "http://localhost:${localPort}/@react-refresh"
			RefreshRuntime.injectIntoGlobalHook(window)
			window.$RefreshReg$ = () => {}
			window.$RefreshSig$ = () => (type) => type
			window.__vite_plugin_react_preamble_installed__ = true
		</script>
	`

	const csp = [
		"default-src 'none'",
		`font-src ${webview.cspSource} data:`,
		`style-src ${webview.cspSource} 'unsafe-inline' https://* http://${localServerUrl} http://0.0.0.0:${localPort}`,
		`img-src ${webview.cspSource} https://storage.googleapis.com https://img.clerk.com data:`,
		`media-src ${webview.cspSource}`,
		`script-src 'unsafe-eval' ${webview.cspSource} https://* https://*.posthog.com http://${localServerUrl} http://0.0.0.0:${localPort} 'nonce-${nonce}'`,
		`connect-src ${webview.cspSource} ${openRouterDomain} https://* https://*.posthog.com ws://${localServerUrl} ws://0.0.0.0:${localPort} http://${localServerUrl} http://0.0.0.0:${localPort}`,
		"frame-src http://localhost:* http://127.0.0.1:*",
	]

	return /*html*/ `
		<!DOCTYPE html>
		<html lang="en">
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
				<meta http-equiv="Content-Security-Policy" content="${csp.join("; ")}">
				<link rel="stylesheet" type="text/css" href="${stylesUri}">
				<link href="${codiconsUri}" rel="stylesheet" />
				<script nonce="${nonce}">
					window.IMAGES_BASE_URI = "${imagesUri}"
					window.AUDIO_BASE_URI = "${audioUri}"
					window.MATERIAL_ICONS_BASE_URI = "${materialIconsUri}"
				</script>
				<title>Jabberwock</title>
			</head>
			<body>
				<div id="root"></div>
				${reactRefresh}
				<script type="module" src="${scriptUri}"></script>
			</body>
		</html>
	`
}

/**
 * Get production HTML content for the webview.
 */
export async function getHtmlContent(provider: ClineProvider, webview: vscode.Webview): Promise<string> {
	const p = provider as any

	// The CSS file from the React build output
	const stylesUri = getUri(webview, p.contextProxy.extensionUri, ["webview-ui", "build", "assets", "index.css"])

	const scriptUri = getUri(webview, p.contextProxy.extensionUri, ["webview-ui", "build", "assets", "index.js"])
	const codiconsUri = getUri(webview, p.contextProxy.extensionUri, ["assets", "codicons", "codicon.css"])
	const materialIconsUri = getUri(webview, p.contextProxy.extensionUri, ["assets", "vscode-material-icons", "icons"])
	const imagesUri = getUri(webview, p.contextProxy.extensionUri, ["assets", "images"])
	const audioUri = getUri(webview, p.contextProxy.extensionUri, ["webview-ui", "audio"])

	const nonce = getNonce()

	// Get the OpenRouter base URL from configuration
	const { getState } = await import("../../chat/task/history")
	const state = await getState(provider)
	const apiConfiguration = (state as any).apiConfiguration || {}
	const openRouterBaseUrl = apiConfiguration.openRouterBaseUrl || "https://openrouter.ai"
	// Extract the domain for CSP
	const openRouterDomain = openRouterBaseUrl.match(/^(https?:\/\/[^\/]+)/)?.[1] || "https://openrouter.ai"

	return /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
            <meta name="theme-color" content="#000000">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https://storage.googleapis.com https://img.clerk.com data:; media-src ${webview.cspSource}; script-src ${webview.cspSource} 'wasm-unsafe-eval' 'nonce-${nonce}' https://ph.jabberwock.com 'strict-dynamic'; connect-src ${webview.cspSource} ${openRouterDomain} https://api.requesty.ai https://ph.jabberwock.com; frame-src http://localhost:* http://127.0.0.1:*;">
            <link rel="stylesheet" type="text/css" href="${stylesUri}">
			<link href="${codiconsUri}" rel="stylesheet" />
			<script nonce="${nonce}">
				window.IMAGES_BASE_URI = "${imagesUri}"
				window.AUDIO_BASE_URI = "${audioUri}"
				window.MATERIAL_ICONS_BASE_URI = "${materialIconsUri}"
			</script>
            <title>Jabberwock</title>
          </head>
          <body>
            <noscript>You need to enable JavaScript to run this app.</noscript>
            <div id="root"></div>
            <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
          </body>
        </html>
      `
}

/**
 * Set up the webview message listener.
 */
export function setWebviewMessageListener(
	provider: ClineProvider,
	webview: vscode.Webview,
	marketplaceManager: MarketplaceManager,
): void {
	const p = provider as any
	const onReceiveMessage = async (message: WebviewMessage) =>
		webviewMessageHandler(provider, message, marketplaceManager)

	const messageDisposable = webview.onDidReceiveMessage(onReceiveMessage)
	p.webviewDisposables.push(messageDisposable)
}

export type IWindowManagerStore = Instance<typeof WindowManagerStore>
export type IWindowEntry = Instance<typeof WindowEntry>
