import * as vscode from "vscode"
import type {
	BackendCapabilities,
	ClientTarget,
	DisposableLike,
	IBackendConnector,
} from "../../../packages/types/src/protocol/backend-connector.ts"
import type { WebviewMessage } from "../../../packages/types/src/webview/message.ts"

// The connector lives outside backend/, so it imports backend core via RELATIVE paths — esbuild
// resolves tsconfig `paths` per source-file location and would miss the backend aliases from here.
import {
	resolveWebviewView as resolveWindowManagerView,
	type WebviewMessageHandler,
} from "../../../backend/features/foundation/window-manager/store"
import { sendViaView } from "../../../backend/features/foundation/window-manager/store/messaging"

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

	constructor(
		private readonly _context: vscode.ExtensionContext,
		/** Retained for parity with the §4.2 bootstrap sketch; logging flows through capabilities.logger. */
		private readonly _outputChannel: vscode.OutputChannel,
	) {}

	// ─── IBackendConnector ───────────────────────────────────────────
	async start(deps: BackendCapabilities, _opts?: Record<string, unknown>): Promise<void> {
		this.capabilities = deps
	}

	async stop(): Promise<void> {
		this.inboundHandlers = []
		this.capabilities = undefined
	}

	sendOutbound(
		message: { type: string; [key: string]: unknown },
		_target?: ClientTarget,
	): void {
		if (!this.capabilities) {
			console.warn(
				`[jabberwock] [VscodeWebviewBackendConnector] sendOutbound SKIPPED - connector not started! type=${message.type}`,
			)
			return
		}
		sendViaView(this, message)
	}

	onInbound(handler: (clientId: string, body: WebviewMessage) => void): DisposableLike {
		this.inboundHandlers.push(handler)
		return { dispose: () => this.removeInboundHandler(handler) }
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
