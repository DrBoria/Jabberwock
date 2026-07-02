import { getStoreState } from "../mst/snapshot/snapshot.js"
import { searchBackendState, searchFrontendState } from "../mst/search.js"
import {
	getStoreActions,
	filterActions,
	searchActions,
	countActions,
	getStoreActionsLog,
	getFrontendStoreActions,
	filterFrontendActions,
	searchFrontendActions,
	countFrontendActions,
	getFrontendStoreActionsLog,
} from "../mst/actions.js"
import { MessageInterceptor } from "../utils/interceptor.js"
import type { BackendStore, FrontendBridge } from "../mst/types.js"
import * as vscode from "vscode"
import { diagnosticsManager } from "../../diagnostics/managers/DiagnosticsManager.js"
import type { SnapshotFilters } from "../../diagnostics/types.js"
import type { DevtoolBridgeProvider } from "./factory-helpers.js"
import type { GetStoreStateParams } from "../mst/snapshot/snapshot.js"
import type { SearchParams } from "../mst/search.js"
import type { ActionParams, FilterActionParams, SearchActionParams, ActionLogParams } from "../mst/actions.js"

export function createStateMethods(
	provider: DevtoolBridgeProvider,
	backendStore: BackendStore | undefined,
	frontendBridge: FrontendBridge | undefined,
	interceptor: MessageInterceptor,
) {
	return {
		async getLogs(lines = 100) {
			const allLogs = diagnosticsManager.getAllLogs()
			const totalLines = allLogs.length
			const endIndex = allLogs.length
			const startIndex = Math.max(0, endIndex - lines)
			const sliced = allLogs.slice(startIndex, endIndex).reverse()
			const formattedLines = sliced.map((e) => {
				const timestamp = new Date(e.timestamp).toISOString()
				return `[${timestamp}][${e.level.toUpperCase()}] ${e.message}`
			})
			return JSON.stringify({ lines: formattedLines, totalLines })
		},

		async getDiagnosticsSnapshot(params?: Record<string, unknown>) {
			const snapshot = diagnosticsManager.getSnapshot(params as SnapshotFilters)
			return JSON.stringify(snapshot)
		},

		async clearDiagnostics(): Promise<string> {
			diagnosticsManager.clear()
			return JSON.stringify({ success: true })
		},

		async getExtensionInfo() {
			try {
				const ext = vscode.extensions.getExtension("rooveterinaryinc.roo-cline")
				return JSON.stringify({
					name: "Jabberwock DevTools",
					version: ext?.packageJSON?.version ?? "dev",
					stores: ["chat", "settings", "foundation"],
				})
			} catch {
				return JSON.stringify({
					name: "Jabberwock DevTools",
					version: "dev",
					stores: ["chat", "settings", "foundation"],
				})
			}
		},

		async getCurrentState() {
			if (backendStore) {
				const mstStore = backendStore.getMstStore()
				if (mstStore) {
					return JSON.stringify({
						chat: Object.keys(mstStore.chat ?? {}),
						settings: Object.keys(mstStore.settings ?? {}),
						foundation: Object.keys(mstStore.foundation ?? {}),
					})
				}
			}
			return JSON.stringify({ error: "No store available" })
		},

		async getStoreState(params: GetStoreStateParams) {
			return getStoreState(
				{
					env: params?.env,
					store: params?.store,
					path: params?.path,
					limit: params?.limit,
					cursor: params?.cursor,
					fields: params?.fields,
				},
				backendStore,
				frontendBridge,
			)
		},

		async searchState(params: SearchParams) {
			if (params.env === "backend") {
				return searchBackendState(params, backendStore)
			}
			return searchFrontendState(params, frontendBridge)
		},

		async getStoreActions(params: ActionParams) {
			if (params.env === "backend") {
				return getStoreActions(params, backendStore)
			}
			return getFrontendStoreActions(params, frontendBridge)
		},

		async filterActions(params: FilterActionParams) {
			if (params.env === "backend") {
				return filterActions(params, backendStore)
			}
			return filterFrontendActions(params, frontendBridge)
		},

		async searchActions(params: SearchActionParams) {
			if (params.env === "backend") {
				return searchActions(params, backendStore)
			}
			return searchFrontendActions(params, frontendBridge)
		},

		async countActions(params: ActionParams) {
			if (params.env === "backend") {
				return countActions(params, backendStore)
			}
			return countFrontendActions(params, frontendBridge)
		},

		async getStoreActionsLog(params: ActionLogParams) {
			if (params.env === "backend") {
				return getStoreActionsLog(params, backendStore)
			}
			return getFrontendStoreActionsLog(params, frontendBridge)
		},

		async sendMessage(type: string, action: string, payload: unknown) {
			provider.postMessageToWebview(type, { action, payload })
		},

		async setMessageInterceptor(
			direction: "send" | "receive",
			type: string,
			action: string | undefined,
			response: unknown,
		) {
			interceptor.set({ direction, type, action, response: response as Record<string, unknown> | undefined })
		},

		async clearInterceptors() {
			interceptor.clear()
		},

		async getActiveInterceptors() {
			return JSON.stringify(interceptor.getActive())
		},

		async clearMessageTrace() {
			interceptor.clearTrace()
		},

		async applyPreviousState(): Promise<string> {
			return JSON.stringify({ success: false, error: "Not implemented" })
		},

		async applyNextState(): Promise<string> {
			return JSON.stringify({ success: false, error: "Not implemented" })
		},

		async getModes(): Promise<string> {
			const modes = await provider.getModes()
			return JSON.stringify(modes)
		},

		async getMode(): Promise<string> {
			const mode = await provider.getMode()
			return JSON.stringify(mode)
		},
	}
}
