import * as fs from "node:fs"
import * as http from "node:http"
import * as path from "node:path"
import * as vscode from "vscode"
import type {
	BackendCapabilities,
	ClientTarget,
	DisposableLike,
	IBackendConnector,
} from "../../../packages/types/src/protocol/backend-connector.ts"
import type { WebviewMessage } from "../../../packages/types/src/webview/message.ts"
import { StaticFileServer, WsServerCore } from "@jabberwock/ws-protocol"

// The connector lives outside backend/. Backend code is reachable either way: esbuild pins
// `tsconfig: backend/tsconfig.json` for the WHOLE extension bundle (see backend/esbuild.mjs), so the
// backend `@features`/`@utils`/… aliases resolve from "here" too. We still import backend core via
// relative paths to keep the connector's graph explicit about crossing the connector → backend boundary.
import { resolveWebviewView as resolveWindowManagerView, type SurfaceMessageHandler } from "./vscode-surface"
import { sendViaView } from "../../../backend/features/foundation/window-manager/lib/messaging"
import { buildHydrationState } from "../../../backend/features/hydration"

/**
 * v4 Phase B3 (§4.2): VSCode backend connector.
 *
 * This is the ONLY file in the extension chain allowed to import "vscode" (purity rule G6).
 * It owns the vscode webview lifecycle (implements `vscode.WebviewViewProvider`) and adapts
 * the transport to the `IBackendConnector` contract:
 *
 *   - OUTBOUND: `sendOutbound` → window-manager view postMessage. In vscode mode there is a
 *     single active webview (the window-manager singleton state), so broadcast/client
 *     targeting collapses onto it (§4.2).
 *   - INBOUND: `onDidReceiveMessage` → `dispatchInbound` → `onInbound` handlers. Bootstrap
 *     subscribes `connector.onInbound((clientId, body) => capabilities.queue.push(...))` —
 *     the queue drain consumer feeds the existing `webviewMessageHandler` resolver (§4.6).
 */
export class VscodeWebviewBackendConnector implements IBackendConnector, vscode.WebviewViewProvider {
	readonly id = "vscode" as const

	private capabilities?: BackendCapabilities
	private inboundHandlers: Array<(clientId: string, body: WebviewMessage) => void> = []

	// v4 single-state (§4.1/§4.2): WS+HTTP listener so the extension-host backend also serves
	// non-vscode clients (browser, smartwatch, APK) over the shared WS protocol. The webview
	// stays a first-class client over postMessage; every WS client is an equal peer.
	private httpServer?: http.Server
	private wsCore?: WsServerCore
	private staticServer?: StaticFileServer
	private staticDir = ""
	private wsPort = 0

	constructor(
		private readonly _context: vscode.ExtensionContext,
		/** Retained for parity with the §4.2 bootstrap sketch; logging flows through capabilities.logger. */
		private readonly _outputChannel: vscode.OutputChannel,
	) {}

	// ─── IBackendConnector ───────────────────────────────────────────
	async start(deps: BackendCapabilities, _opts?: Record<string, unknown>): Promise<void> {
		this.capabilities = deps
		await this.startWsListener(deps)
	}

	async stop(): Promise<void> {
		this.wsCore?.stop()
		this.wsCore = undefined
		if (this.httpServer) {
			const server = this.httpServer
			this.httpServer = undefined
			await new Promise<void>((resolve) => server.close(() => resolve()))
		}
		this.staticServer = undefined
		this.inboundHandlers = []
		this.capabilities = undefined
	}

	sendOutbound(message: { type: string; [key: string]: unknown }, target?: ClientTarget): void {
		if (!this.capabilities) {
			console.warn(
				`[jabberwock] [VscodeWebviewBackendConnector] sendOutbound SKIPPED - connector not started! type=${message.type}`,
			)
			return
		}
		// A client-targeted message is routed to exactly that client: either the webview
		// (clientId "vscode") or a WS client (handled by the core's registry). Broadcasts
		// fan out to the webview AND every connected WS client (§4.1).
		if (target && target.kind === "client") {
			if (target.clientId === "vscode") {
				sendViaView(this, message)
			} else {
				this.wsCore?.sendOutbound(message, target)
			}
			return
		}
		sendViaView(this, message)
		this.wsCore?.sendOutbound(message, target)
	}

	onInbound(handler: (clientId: string, body: WebviewMessage) => void): DisposableLike {
		this.inboundHandlers.push(handler)
		return { dispose: () => this.removeInboundHandler(handler) }
	}

	// ─── WS + HTTP listener (v4 single-state §4.1/§4.2) ─────────────
	/**
	 * Bring up the loopback HTTP+WS server on the extension host. The WS core speaks the
	 * exact same protocol as the standalone server (hello → state, ConnectorEnvelope,
	 * multi-client registry) — one implementation from `@jabberwock/ws-protocol`. The HTTP
	 * surface serves the built SPA (`frontend/build`) plus a `config.js` that points the
	 * browser at this WS endpoint, so dev = "F5 → open http://127.0.0.1:3000".
	 */
	private async startWsListener(deps: BackendCapabilities): Promise<void> {
		const port = Number(process.env.JABBERWOCK_VSCODE_WS_PORT ?? 3000)
		const bindAddress = process.env.JABBERWOCK_VSCODE_WS_BIND ?? "127.0.0.1"

		this.httpServer = http.createServer((req, res) => {
			const url = new URL(req.url ?? "/", "http://localhost")
			if (url.pathname === "/healthz") {
				res.writeHead(200, { "Content-Type": "application/json" })
				res.end(JSON.stringify({ status: "ok", host: "vscode-extension", uptime: process.uptime() }))
				return
			}
			if (url.pathname === "/config.js") {
				const wsUrl = `ws://${bindAddress}:${port}/ws`
				res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" })
				// IMAGES_BASE_URI is "" on the web surface: the logo is shipped to the
				// build root (frontend/public → frontend/build/jabberwock-logo.png) and
				// JabberwockHero.tsx builds `${IMAGES_BASE_URI}/jabberwock-logo.png`.
				res.end(
					`window.__JABBERWOCK_CONFIG__ = { wsUrl: ${JSON.stringify(wsUrl)} };\n` +
						`window.IMAGES_BASE_URI = "";\n`,
				)
				return
			}
			// SPA routes (extensionless paths that are not real files) get index.html with
			// the config.js script injected — the browser bundle then resolves wsUrl from
			// window.__JABBERWOCK_CONFIG__ (BrowserWsFrontendConnector, plan §9.4). The
			// vscode webview never goes through this HTTP surface, so its bundle stays clean.
			if (this.staticServer && !path.extname(url.pathname) && !this.isStaticFile(url.pathname)) {
				this.serveSpaIndex(res)
				return
			}
			if (this.staticServer?.handle(req, res)) return
			res.writeHead(404, { "Content-Type": "text/plain" })
			res.end("Not Found")
		})

		this.staticDir = this.resolveStaticDir()
		if (fs.existsSync(this.staticDir)) {
			this.staticServer = new StaticFileServer(this.staticDir)
			deps.logger.info(`[VscodeWebviewBackendConnector] serving SPA from ${this.staticDir}`)
		} else {
			deps.logger.warn(
				`[VscodeWebviewBackendConnector] static dir not found at ${this.staticDir}; run 'pnpm build:webview' first`,
			)
		}

		// The hello → state handshake hands the client the FLAT ExtensionState-shaped payload
		// (buildHydrationState) so the frontend `mergeExtensionState` can apply provider +
		// history. Resolved lazily per handshake because the root store is created by
		// startBackend() AFTER connector.start().
		this.wsCore = new WsServerCore({
			server: this.httpServer,
			path: "/ws",
			getState: buildHydrationState,
		})
		this.wsCore.start(deps)
		this.wsCore.onInbound((clientId, body) => this.dispatchInbound(clientId, body))

		await new Promise<void>((resolve, reject) => {
			const onError = (error: Error): void => reject(error)
			this.httpServer?.once("error", onError)
			this.httpServer?.listen(port, bindAddress, () => {
				this.httpServer?.off("error", onError)
				resolve()
			})
		})
		this.wsPort = port
		deps.logger.info(
			`[VscodeWebviewBackendConnector] WS+HTTP listening on ws://${bindAddress}:${port}/ws (SPA + /config.js)`,
		)
	}

	/** The port the WS+HTTP listener is bound to (0 when not started or the port was refused). */
	get wsListenerPort(): number {
		return this.wsPort
	}

	/**
	 * Resolve the built SPA directory. In the extension host `process.cwd()` is NOT the repo
	 * root (it is wherever VS Code was launched from), so we anchor on the extension's own
	 * location: `extensionUri` points at `backend/`, and the frontend build lives one level up
	 * at `frontend/build`. An explicit `JABBERWOCK_STATIC_DIR` env always wins; the `cwd`
	 * resolution is kept as a last-resort fallback (matches the standalone server's behavior
	 * when launched from the repo root).
	 */
	private resolveStaticDir(): string {
		if (process.env.JABBERWOCK_STATIC_DIR) return process.env.JABBERWOCK_STATIC_DIR
		const candidates: string[] = []
		// extensionUri = file://…/backend (the extensionDevelopmentPath). frontend/build is a
		// sibling of backend/, i.e. ../frontend/build relative to it.
		//
		// NOTE: do NOT use `vscode.Uri.fsPath` here — the vscode module available to the
		// extension host at runtime does not expose the static `Uri.fsPath` helper (it throws
		// "Uri.fsPath is not a function"). The `Uri` instance's `.path` property is always
		// available, so we derive the filesystem path from it directly (see `uriToFsPath`).
		try {
			const extDir = this.uriToFsPath(this._context.extensionUri)
			candidates.push(path.resolve(extDir, "..", "frontend", "build"))
		} catch {
			// extensionUri unavailable (should not happen); fall through to cwd.
		}
		candidates.push(path.resolve(process.cwd(), "frontend", "build"))
		for (const candidate of candidates) {
			if (fs.existsSync(path.join(candidate, "index.html"))) return candidate
		}
		return candidates[0] ?? path.resolve(process.cwd(), "frontend", "build")
	}

	/**
	 * Convert a `vscode.Uri` to a filesystem path WITHOUT relying on the static
	 * `vscode.Uri.fsPath` helper, which is not present on the vscode module this extension
	 * host loads at runtime (it throws "Uri.fsPath is not a function"). The `Uri` instance's
	 * `.path` property is always available. For `file:` URIs the `.path` already is the
	 * filesystem path; we percent-decode it to be safe.
	 */
	private uriToFsPath(uri: { path?: string; scheme?: string; toString?: () => string }): string {
		// Prefer the real helper when it exists (production VS Code ships it).
		const fsPath = (vscode.Uri as unknown as { fsPath?: (u: unknown) => string }).fsPath
		if (typeof fsPath === "function") {
			try {
				return fsPath.call(vscode.Uri, uri)
			} catch {
				// fall through to the manual derivation below
			}
		}
		const raw = uri.path ?? ""
		try {
			return decodeURIComponent(raw)
		} catch {
			return raw
		}
	}

	/** True when the URL path maps to a real file under the static dir (so it is served as-is). */
	private isStaticFile(urlPathname: string): boolean {
		if (!this.staticDir) return false
		const filePath = path.normalize(path.join(this.staticDir, decodeURIComponent(urlPathname)))
		if (!filePath.startsWith(this.staticDir)) return false
		return fs.existsSync(filePath) && fs.statSync(filePath).isFile()
	}

	/** Serve `index.html` with the config.js script injected before the app bundle loads. */
	private serveSpaIndex(res: http.ServerResponse): void {
		const indexPath = path.join(this.staticDir, "index.html")
		if (!fs.existsSync(indexPath)) {
			res.writeHead(404, { "Content-Type": "text/plain" })
			res.end("Not Found")
			return
		}
		let html = fs.readFileSync(indexPath, "utf-8")
		const inject = `<script src="/config.js"></script>\n</body>`
		html = html.replace("</body>", inject)
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" })
		res.end(html)
	}

	// ─── ProviderHandle-compatible surface (window-manager store) ─────
	async postMessageToWebview(message: Record<string, unknown>): Promise<boolean> {
		this.sendOutbound(message as { type: string; [key: string]: unknown })
		return true
	}

	get context(): { globalStorageUri: { fsPath: string } } {
		return { globalStorageUri: { fsPath: this._context.globalStorageUri.fsPath } }
	}

	// ─── vscode.WebviewViewProvider (lifecycle owned here, §4.2) ─────
	async resolveWebviewView(webviewView: vscode.WebviewView | vscode.WebviewPanel): Promise<void> {
		const messageHandler: WebviewMessageHandler = async (_provider, message) => {
			this.dispatchInbound("vscode", message)
		}
		await resolveWindowManagerView(this, webviewView, messageHandler)
	}

	// ─── Inbound dispatch ────────────────────────────────────────────
	dispatchInbound(clientId: string, body: WebviewMessage): void {
		for (const handler of [...this.inboundHandlers]) {
			try {
				handler(clientId, body)
			} catch (error) {
				console.error("[jabberwock] [VscodeWebviewBackendConnector] inbound handler error:", error)
			}
		}
	}

	getInboundHandlerCount(): number {
		return this.inboundHandlers.length
	}

	private removeInboundHandler(handler: (clientId: string, body: WebviewMessage) => void): void {
		const idx = this.inboundHandlers.indexOf(handler)
		if (idx !== -1) this.inboundHandlers.splice(idx, 1)
	}
}
