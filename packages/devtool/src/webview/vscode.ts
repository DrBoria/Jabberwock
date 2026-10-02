/**
 * VSCode API wrapper for webview communication.
 *
 * A utility wrapper around the acquireVsCodeApi() function, which enables
 * message passing and state management between the webview and extension
 * contexts.
 *
 * This utility also enables webview code to be run in a web browser-based
 * dev server by using native web browser features that mock the functionality
 * enabled by acquireVsCodeApi.
 *
 * Originally from "webview-ui/src/features/devtools/utils/vscode.ts",
 * moved into @jabberwock/devtool so the package is self-contained.
 */

// @types/vscode-webview provides the WebviewApi type.
// vscode-webview is not a real npm package (only @types/vscode-webview exists),
// but the types package registers the global `acquireVsCodeApi` function and
// the `WebviewApi` interface.
import type { WebviewApi } from "vscode-webview"

/**
 * WebviewMessage type — re-exported from "@jabberwock/types."
 * The extension host sends/receives messages of this shape.
 */
import type { WebviewMessage } from "@jabberwock/types"

class VSCodeAPIWrapper {
	private readonly vsCodeApi: WebviewApi<unknown> | undefined

	constructor() {
		// The webview HTML injects an early error-capture script (connectors/vscode/backend/html-utils.ts)
		// that calls acquireVsCodeApi() ONCE and exposes it on window.__JABBERWOCK_EARLY_API__.
		// acquireVsCodeApi() may only be called once per webview, so reuse that instance when present
		// instead of calling it again here.
		const earlyApi = (globalThis as { __JABBERWOCK_EARLY_API__?: WebviewApi<unknown> }).__JABBERWOCK_EARLY_API__
		if (earlyApi) {
			this.vsCodeApi = earlyApi
		} else if (typeof acquireVsCodeApi === "function") {
			this.vsCodeApi = acquireVsCodeApi()
		}
	}

	public postMessage(message: WebviewMessage) {
		if (this.vsCodeApi) {
			this.vsCodeApi.postMessage(message)
		}
		// No host present (plain web mode). Deliberately a silent no-op:
		// logging `message` here would be re-intercepted by the console bridge
		// (packages/devtool/src/webview/console.ts), which posts a webviewLog
		// whose serialization embeds the previous one — an exponential
		// self-referential loop that OOMs the renderer in ~20s.
	}

	public getState(): unknown | undefined {
		if (this.vsCodeApi) {
			return this.vsCodeApi.getState()
		} else {
			const state = localStorage.getItem("vscodeState")
			return state ? JSON.parse(state) : undefined
		}
	}

	public setState<T extends unknown | undefined>(newState: T): T {
		if (this.vsCodeApi) {
			return this.vsCodeApi.setState(newState)
		} else {
			localStorage.setItem("vscodeState", JSON.stringify(newState))
			return newState
		}
	}
}

export const vscode = new VSCodeAPIWrapper()
