import * as vscode from "vscode"
import * as path from "path"
import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import { getNonce } from "@utils/ui"
import { getUri } from "./getUri"
import { getHostEnvironment } from "@features/foundation/host-context/context"
import { WEBVIEW_BUILD_DIR } from "@shared/webviewBuildDir"

const webviewBuildSegments = WEBVIEW_BUILD_DIR.split("/") // ["frontend", "build"] — v4 layout, §3.3/R1

function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

export function getHtmlContent(provider: ProviderHandle, webview: vscode.Webview): string {
	const nonce = getNonce()
	const buildVersion = Date.now().toString(36)
	const workspaceRootUri = vscode.Uri.file(path.resolve(getHostEnvironment().extensionUri.fsPath, ".."))
	const scriptUriParts = [...webviewBuildSegments, "assets", "index.js"]
	const styleUriParts = [...webviewBuildSegments, "assets", "index.css"]

	const scriptUri = String(getUri(webview, workspaceRootUri, scriptUriParts)) + `?v=${buildVersion}`
	const styleUri = String(getUri(webview, workspaceRootUri, styleUriParts)) + `?v=${buildVersion}`

	const isDev = getHostEnvironment().extensionMode === vscode.ExtensionMode.Development
	const cspMeta = isDev
		? ""
		: `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource} 'wasm-unsafe-eval'; connect-src 'self' https: http:">`

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	${cspMeta}
	<link rel="stylesheet" type="text/css" href="${styleUri}">
	<title>Jabberwock</title>
</head>
<body>
	<div id="root"></div>
	<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`
}

export function getHMRHtmlContent(provider: ProviderHandle, webview: vscode.Webview): string {
	try {
		const extensionRoot = path.dirname(getHostEnvironment().extensionUri.fsPath)
		// dev HMR port file lives at the frontend package root (= dirname of WEBVIEW_BUILD_DIR)
		const vitePortPath = path.join(extensionRoot, path.dirname(WEBVIEW_BUILD_DIR), ".vite-port")
		const { existsSync, readFileSync } = require("fs") as typeof import("fs")
		if (!existsSync(vitePortPath)) {
			console.warn("[jabberwock] .vite-port not found, falling back to production build")
			return getHtmlContent(provider, webview)
		}

		const port = Number(readFileSync(vitePortPath, "utf-8").trim())
		if (Number.isNaN(port) || port <= 0) {
			console.warn("[jabberwock] Invalid .vite-port value, falling back to production build")
			return getHtmlContent(provider, webview)
		}

		try {
			const { execSync } = require("child_process") as typeof import("child_process")
			execSync(`lsof -i :${port} 2>/dev/null`, { timeout: 1000 })
		} catch {
			console.warn("[jabberwock] Vite dev server not running, falling back to production build")
			return getHtmlContent(provider, webview)
		}

		const nonce = getNonce()

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<script type="module" nonce="${nonce}" src="http://localhost:${port}/@vite/client"></script>
	<title>Jabberwock</title>
</head>
<body>
	<div id="root"></div>
	<script type="module" nonce="${nonce}" src="http://localhost:${port}/src/index.tsx"></script>
</body>
</html>`
	} catch (error) {
		console.error("[jabberwock] Error in getHMRHtmlContent:", error)
		return getHtmlContent(provider, webview)
	}
}

export function getErrorHtml(errorMessage: string): string {
	return `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Jabberwock Error</title>
	<style>
		body { padding: 20px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
		.error { color: var(--vscode-errorForeground); }
		.details {
			margin-top: 12px;
			padding: 12px;
			background: var(--vscode-inputValidation-errorBackground);
			border: 1px solid var(--vscode-inputValidation-errorBorder);
			border-radius: 4px;
			font-family: monospace;
			white-space: pre-wrap;
			word-break: break-all;
			font-size: 12px;
		}
	</style>
</head>
<body>
	<h2 class="error">Failed to load Jabberwock</h2>
	<p>An unexpected error occurred. Please try reloading the window.</p>
	<div class="details">${escapeHtml(errorMessage)}</div>
</body>
</html>`
}
