import EventEmitter from "events"
import * as vscode from "vscode"
import type { TaskProviderEvents } from "@jabberwock/types"

import { Package } from "../../../shared/package"
import type { MdmService } from "../../../services/mdm/MdmService"

import {
	resolveWebviewView as resolveWindowManagerView,
	postMessageToWebview as postMessageToWebviewStore,
	getWindowManagerState,
	WebviewOutboundMessage,
} from "../window-manager/store"
import { webviewMessageHandler } from "./events/handlers/on-webview-message"

export class EventBridge extends EventEmitter<TaskProviderEvents> implements vscode.WebviewViewProvider {
	readonly mdmService?: MdmService
	static readonly sideBarId = `${Package.name}.SidebarProvider`
	private static activeInstances: Set<EventBridge> = new Set()
	static outputChannel: vscode.OutputChannel | undefined

	constructor(
		readonly context: vscode.ExtensionContext,
		private readonly _outputChannel: vscode.OutputChannel,
		public readonly renderContext: "sidebar" | "editor" = "sidebar",
		mdmService?: MdmService,
	) {
		super()
		EventBridge.activeInstances.add(this)
		EventBridge.outputChannel = _outputChannel
		this.mdmService = mdmService
	}

	/**
	 * Find a visible EventBridge instance (sidebar or editor).
	 * Used by extension activation code to get the active webview provider.
	 */
	static getVisibleInstance(): EventBridge | undefined {
		return Array.from(EventBridge.activeInstances).find((i) => {
			try {
				return i.renderContext === "sidebar" || i.renderContext === "editor"
			} catch {
				return false
			}
		})
	}

	/**
	 * Get the first available EventBridge instance.
	 * Used by extension activation code when any provider instance will do.
	 */
	static getFirstAvailableInstance(): EventBridge | undefined {
		return Array.from(EventBridge.activeInstances)[0]
	}

	/**
	 * Initialize all feature states asynchronously.
	 * Must be called AFTER createBackendRootStore() so stores are available.
	 */
	async initFeatures(): Promise<void> {
		// Feature initialization moved to extension.ts or individual store setup
		// in Phase 2 refactoring — EventBridge no longer orchestrates feature init.
	}

	// ─── WebviewViewProvider interface (MANDATORY — vscode API) ──────
	async resolveWebviewView(webviewView: vscode.WebviewView | vscode.WebviewPanel) {
		return resolveWindowManagerView(this, webviewView, webviewMessageHandler)
	}

	// ─── Public API — pure IPC ─────────────────────────────
	async postMessageToWebview(message: WebviewOutboundMessage): Promise<boolean> {
		return postMessageToWebviewStore(this, message)
	}

	// ─── Lifecycle ──────────────────────────────────────────────────
	dispose(): void {
		try {
			const state = getWindowManagerState(this)
			if (state) {
				state.disposables.forEach((d: vscode.Disposable) => d.dispose())
			}
		} catch {
			// State may not be available during dispose
		}
		EventBridge.activeInstances.delete(this)
	}

	// ─── Tab panel identifier ──────────────────────────────────────
	static readonly tabPanelId = `${Package.name}.TabPanel`
}
