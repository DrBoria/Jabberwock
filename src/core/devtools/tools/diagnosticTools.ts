import { z } from "zod"
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../webview/ClineProvider"
import * as vscode from "vscode"
import fs from "fs"

export function registerDiagnosticTools(mcpServer: McpServer, provider: ClineProvider) {
	mcpServer.tool(
		"get_logs",
		{
			lines: z.number().optional().describe("Number of recent lines to read. Default is 100."),
		},
		async ({ lines = 100 }) => {
			try {
				const logPath = vscode.Uri.joinPath(
					provider.contextProxy.globalStorageUri,
					"jabberwock.diagnostics.log",
				).fsPath
				if (!fs.existsSync(logPath)) {
					return { content: [{ type: "text", text: "Diagnostics log file does not exist yet." }] }
				}
				const content = fs.readFileSync(logPath, "utf-8")
				const logLines = content.split("\n").filter(Boolean)
				const recent = logLines.slice(-Math.abs(lines))
				return { content: [{ type: "text", text: recent.join("\n") }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool("get_diagnostics_snapshot", {}, async () => {
		try {
			const { diagnosticsManager } = await import("../DiagnosticsManager")
			const snapshot = diagnosticsManager.getSnapshot()
			return { content: [{ type: "text", text: JSON.stringify(snapshot, null, 2) }] }
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Error reading diagnostics: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	})

	mcpServer.tool(
		"get_mst_state",
		{
			nodeId: z.string().optional().describe("Optional: specific node ID to inspect. Omit for full tree."),
		},
		async ({ nodeId }) => {
			try {
				const { getSnapshot } = await import("mobx-state-tree")
				const snapshot = getSnapshot(provider.chatStore)

				if (nodeId) {
					const nodes = snapshot.nodes as Record<string, unknown>
					const node = nodes[nodeId]
					if (!node) {
						return {
							content: [{ type: "text", text: `Node '${nodeId}' not found in ChatStore.` }],
							isError: true,
						}
					}
					return { content: [{ type: "text", text: JSON.stringify(node, null, 2) }] }
				}

				return { content: [{ type: "text", text: JSON.stringify(snapshot, null, 2) }] }
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error reading MST state: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool(
		"get_mode_switches",
		{
			lines: z.number().optional().describe("Number of recent lines to search. Default is 500."),
		},
		async ({ lines = 500 }) => {
			try {
				const logPath = vscode.Uri.joinPath(
					provider.contextProxy.globalStorageUri,
					"jabberwock.diagnostics.log",
				).fsPath
				if (!fs.existsSync(logPath)) {
					return { content: [{ type: "text", text: "Diagnostics log file does not exist yet." }] }
				}
				const content = fs.readFileSync(logPath, "utf-8")
				const logLines = content.split("\n").filter(Boolean)
				const recent = logLines.slice(-Math.abs(lines))

				const switches = recent
					.filter((line) => line.includes("Successfully switched to mode:"))
					.map((line) => {
						const match = line.match(/\[(.*?)\]\[.*?\] \[CONSOLE\] Successfully switched to mode: (.*)/)
						return {
							timestamp: match ? match[1] : "unknown",
							mode: match ? match[2] : "unknown",
							raw: line,
						}
					})

				return { content: [{ type: "text", text: JSON.stringify(switches, null, 2) }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	mcpServer.tool("get_extension_info", {}, async () => {
		try {
			const { Package } = await import("../../../shared/package")
			const { getSnapshot } = await import("mobx-state-tree")

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								name: Package.name,
								version: Package.version,
								sha: Package.sha,
								renderContext: provider.renderContext,
								stackSize: provider.getTaskStackSize(),
								activeNodeId: provider.chatStore.activeNodeId,
								nodesCount: Object.keys(getSnapshot(provider.chatStore).nodes || {}).length,
							},
							null,
							2,
						),
					},
				],
			}
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error fetching extension info: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	})
}
