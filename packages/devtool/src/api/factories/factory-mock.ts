import * as vscode from "vscode"
import type { ExtensionBridge } from "../bridge.js"
import { MessageInterceptor } from "../utils/interceptor.js"

/**
 * Creates a stub bridge for initial setup before real methods are wired.
 */
export function createMockBridge(_interceptor?: MessageInterceptor): ExtensionBridge {
	return {
		executeVscodeCommand: async (command: string, args: unknown) => {
			await vscode.commands.executeCommand(command, ...(Array.isArray(args) ? args : []))
			await vscode.commands.executeCommand(command, ...(Array.isArray(args) ? args : []))
			return ""
		},
		getActivePage: async () => {
			return ""
		},
		getConsole: (_params: { env: "backend" | "frontend"; level?: string; limit?: number; cursor?: number }) =>
			Promise.resolve(JSON.stringify({ lines: [], totalLines: 0 })),
		searchConsole: (_params: {
			query: string
			env?: "backend" | "frontend"
			level?: string
			limit?: number
			cursor?: number
		}) => Promise.resolve(JSON.stringify({ lines: [], totalLines: 0 })),
		getLogs: (_lines?: number) => Promise.resolve(""),
		getExtensionInfo: () =>
			Promise.resolve(
				JSON.stringify({
					name: "Jabberwock DevTools",
					version: "1.0.0",
					stores: ["chat", "settings", "foundation"],
				}),
			),
		getCurrentState: () => Promise.resolve("{}"),
		getStoreState: () => Promise.resolve("{}"),
		searchState: () => Promise.resolve('{"results":[]}'),
		getStoreActions: () => Promise.resolve('{"actions":[]}'),
		filterActions: () => Promise.resolve('{"actions":[]}'),
		searchActions: () => Promise.resolve('{"actions":[]}'),
		countActions: () => Promise.resolve('{"count":0}'),
		getStoreActionsLog: () => Promise.resolve('{"actions":[]}'),
	} as unknown as ExtensionBridge
}
