import * as vscode from "vscode"
import * as path from "path"
import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import { getNonce } from "@utils/ui/getNonce"
import { getUri } from "./getUri"
import { getHostEnvironment } from "@features/foundation/host-context/context"
import { WEBVIEW_BUILD_DIR } from "@shared/webviewBuildDir"

const webviewBuildSegments = WEBVIEW_BUILD_DIR.split("/") // ["frontend", "build"] — v4 layout, §3.3/R1

function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/**
 * Early error-capture script — injected as a CLASSIC (non-module) inline script
 * BEFORE the deferred module bundle, so it runs synchronously on first parse.
 *
 * WHY: the webview's own console bridge (packages/devtool console.ts) only
 * attaches AFTER the bundle loads and React boots. If the bundle fails to load
 * (bad vscode-webview:// URI, CSP block, parse error, OOM), no console bridge
 * ever runs and the failure is completely invisible — the symptom is just a
 * gray/empty webview. This script posts load-time errors straight to the
 * backend via `webviewLog` (→ diagnosticsManager → backend console/log file),
 * readable through the devtool diagnostics tools.
 *
 * It also acquires the vscode webview api ONCE and exposes it on
 * `window.__JABBERWOCK_EARLY_API__`. `acquireVsCodeApi()` may only be called
 * once per webview, so the app's VSCodeAPIWrapper (packages/devtool vscode.ts)
 * reuses this instance instead of calling it again.
 *
 * CSP: in production the inline script carries the same nonce as the
 * `script-src 'nonce-…'` meta; in dev there is no CSP meta at all.
 */
export function getEarlyErrorCaptureScript(nonce: string): string {
	const nonceAttr = nonce ? ` nonce="${nonce}"` : ""
	return `<script${nonceAttr}>
(function(){
  try {
    window.__JABBERWOCK_EARLY_API__ = (typeof acquireVsCodeApi === 'function') ? acquireVsCodeApi() : null;
  } catch (e) { window.__JABBERWOCK_EARLY_API__ = null; }
  window.__JABBERWOCK_EARLY_ERRORS__ = window.__JABBERWOCK_EARLY_ERRORS__ || [];
  function post(text){
    try { if (window.__JABBERWOCK_EARLY_API__) { window.__JABBERWOCK_EARLY_API__.postMessage({ type: 'webviewLog', text: text }); } } catch (e) {}
    try { console.log(text); } catch (e) {}
  }
  function record(level, msg){
    try { window.__JABBERWOCK_EARLY_ERRORS__.push(msg); } catch (e) {}
    post('[EARLY][' + level + '] ' + msg);
  }
  try {
    post('[EARLY][INFO] early-capture installed, readyState=' + document.readyState + ', acquireVsCodeApi=' + (typeof acquireVsCodeApi) + ', api=' + (window.__JABBERWOCK_EARLY_API__ ? 'ok' : 'null'));
  } catch (e) {}
  window.addEventListener('error', function(ev){
    var t = ev.target;
    var isResource = t && (t.tagName === 'SCRIPT' || t.tagName === 'LINK' || t.tagName === 'IMG');
    var src = isResource ? (' resource=' + (t.src || t.href || '(no-src)')) : '';
    var detail = (ev.error && ev.error.stack) ? ev.error.stack : '';
    record('ERROR', 'error: ' + (ev.message || '') + src + ' @' + (ev.filename || '') + ':' + (ev.lineno || '') + ' ' + detail);
  }, true);
  window.addEventListener('unhandledrejection', function(ev){
    var r = ev.reason;
    var msg = (r && r.stack) ? r.stack : (r && r.message) ? r.message : String(r);
    record('ERROR', 'unhandledrejection: ' + msg);
  });
  window.addEventListener('load', function(){
    setTimeout(function(){
      var root = document.getElementById('root');
      record('INFO', 'load: readyState=' + document.readyState + ', rootChildren=' + (root ? root.children.length : 'NO-ROOT') + ', rootHtmlLen=' + (root && root.innerHTML ? root.innerHTML.length : 0));
    }, 1500);
  });
})();
</script>`
}

export function getHtmlContent(provider: ProviderHandle, webview: vscode.Webview): string {
	const nonce = getNonce()
	const buildVersion = Date.now().toString(36)
	const workspaceRootUri = vscode.Uri.file(path.resolve(getHostEnvironment().extensionUri.fsPath, ".."))
	const scriptUriParts = [...webviewBuildSegments, "assets", "index.js"]
	const styleUriParts = [...webviewBuildSegments, "assets", "index.css"]

	const scriptUri = String(getUri(webview, workspaceRootUri, scriptUriParts)) + `?v=${buildVersion}`
	const styleUri = String(getUri(webview, workspaceRootUri, styleUriParts)) + `?v=${buildVersion}`

	// The webview document URL is the webview ROOT (vscode-webview://<id>/), which maps to
	// the workspace root (repo/). The Vite `__vitePreload` helper creates
	// `<link rel="modulepreload" href="assets/chunk-*.js">` from `__vite__mapDeps` — those
	// RELATIVE hrefs resolve against the document base, so WITHOUT a <base> they 404 at
	// vscode-webview://<id>/assets/... instead of .../frontend/build/assets/....
	//
	// A STATIC <base> tag is stripped by VS Code's webview HTML sanitizer, so we inject it
	// at RUNTIME via a classic (non-module) inline script. That script runs during initial
	// parse — BEFORE the deferred module bundle executes and creates the preload links — so
	// the base is in place when the links resolve. Runtime DOM mutations are NOT sanitized.
	// The entry script + CSS above are ABSOLUTE vscode-webview:// URIs, so <base> does not
	// affect them.
	const baseUri = String(getUri(webview, workspaceRootUri, webviewBuildSegments)) + "/"
	// The hero logo (JabberwockHero.tsx) reads window.IMAGES_BASE_URI, which was never
	// set → it resolved the logo against the webview root and 404'd. Point it at the
	// backend assets/images dir (added to localResourceRoots in vscode-surface.ts).
	const imagesBaseUri = String(getUri(webview, workspaceRootUri, ["backend", "assets", "images"]))

	const isDev = getHostEnvironment().extensionMode === vscode.ExtensionMode.Development
	const cspMeta = isDev
		? ""
		: `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; img-src ${webview.cspSource} ${imagesBaseUri}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource} 'wasm-unsafe-eval'; connect-src 'self' https: http:">`

	const earlyScript = getEarlyErrorCaptureScript(nonce)
	// Classic inline script (NOT a module): runs synchronously during parse, before the
	// deferred module bundle. Sets the document base (fixing relative preload links) and
	// the logo base URI.
	const configScript = `<script nonce="${nonce}">
(function(){
  try {
    window.IMAGES_BASE_URI = ${JSON.stringify(imagesBaseUri)};
    var b = document.createElement('base');
    b.href = ${JSON.stringify(baseUri)};
    document.head.insertBefore(b, document.head.firstChild);
    window.__JABBERWOCK_EARLY_API__ && window.__JABBERWOCK_EARLY_API__.postMessage({ type: 'webviewLog', text: '[EARLY][INFO] base injected, baseURI=' + document.baseURI });
  } catch (e) {
    try { window.__JABBERWOCK_EARLY_API__ && window.__JABBERWOCK_EARLY_API__.postMessage({ type: 'webviewLog', text: '[EARLY][ERROR] base inject failed: ' + e }); } catch (e2) {}
  }
})();
</script>`
	return `<!DOCTYPE html>
<html lang="en">
<head>
${earlyScript}
${configScript}
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
		const earlyScript = getEarlyErrorCaptureScript(nonce)

		return `<!DOCTYPE html>
<html lang="en">
<head>
${earlyScript}
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
