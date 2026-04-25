import { z } from "zod"
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../webview/ClineProvider"
import * as vscode from "vscode"
import fs from "fs"
import { diagnosticsManager } from "../DiagnosticsManager"
import { TimelineEventType } from "../types/TimelineTypes"

export function registerLogTools(mcpServer: McpServer, provider: ClineProvider) {
	mcpServer.tool(
		"get_logs",
		{ lines: z.number().optional().describe("Number of recent lines to read. Default is 100.") },
		async ({ lines = 100 }) => {
			try {
				const logPath = vscode.Uri.joinPath(
					provider.contextProxy.globalStorageUri,
					"jabberwock.diagnostics.log",
				).fsPath
				if (!fs.existsSync(logPath)) return { content: [{ type: "text", text: "Log file not found." }] }
				const content = fs.readFileSync(logPath, "utf-8")
				const recent = content.split("\n").filter(Boolean).slice(-Math.abs(lines))
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
			const snapshot = diagnosticsManager.getSnapshot()
			return { content: [{ type: "text", text: JSON.stringify(snapshot, null, 2) }] }
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
				isError: true,
			}
		}
	})

	mcpServer.tool(
		"get_diagnostic_timeline",
		{
			taskId: z.string().optional().describe("Filter by task ID"),
			limit: z.number().optional().describe("Number of events to return. Default 200."),
			type: z
				.enum(["task_lifecycle", "tool_lifecycle", "mst_patch", "log", "metric", "resource_sampling"])
				.array()
				.optional()
				.describe("Filter by event types"),
		},
		async ({ taskId, limit = 200, type }) => {
			try {
				const timeline = diagnosticsManager.getTimeline({
					taskId,
					limit,
					types: type as TimelineEventType[],
				})

				return { content: [{ type: "text", text: JSON.stringify(timeline, null, 2) }] }
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
	mcpServer.tool(
		"get_mode_switches",
		{ lines: z.number().optional().describe("Number of recent lines to search. Default is 500.") },
		async ({ lines = 500 }) => {
			try {
				const logPath = vscode.Uri.joinPath(
					provider.contextProxy.globalStorageUri,
					"jabberwock.diagnostics.log",
				).fsPath
				if (!fs.existsSync(logPath)) return { content: [{ type: "text", text: "Log file not found." }] }
				const content = fs.readFileSync(logPath, "utf-8")
				const recent = content.split("\n").filter(Boolean).slice(-Math.abs(lines))
				const switches = recent
					.filter((line) => line.includes("Successfully switched to mode:"))
					.map((line) => {
						const match = line.match(/\[(.*?)\]\[.*?\] \[CONSOLE\] Successfully switched to mode: (.*)/)
						return { timestamp: match ? match[1] : "unknown", mode: match ? match[2] : "unknown" }
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
	mcpServer.tool(
		"get_console_dump",
		{
			lines: z.number().optional().describe("Number of recent lines. Default is all."),
			level: z
				.enum(["info", "warn", "error", "debug"])
				.optional()
				.describe("Filter by log level. Default is all levels."),
			excludePattern: z
				.string()
				.optional()
				.describe("Exclude lines matching this substring (e.g. 'DEBUG: PROMPT' to hide prompt debug logs)."),
		},
		async ({ lines, level, excludePattern }) => {
			try {
				const snapshot = diagnosticsManager.getSnapshot()
				let filteredLogs = snapshot.logs

				// Filter by level
				if (level) {
					filteredLogs = filteredLogs.filter((l) => l.level === level)
				}

				// Exclude by pattern
				if (excludePattern) {
					filteredLogs = filteredLogs.filter((l) => !l.message.includes(excludePattern))
				}

				// Limit lines
				if (lines && lines > 0) {
					filteredLogs = filteredLogs.slice(-Math.abs(lines))
				}

				const formattedLogs = filteredLogs
					.map((l) => `[${new Date(l.timestamp).toISOString()}][${l.level.toUpperCase()}] ${l.message}`)
					.join("\n")
				return { content: [{ type: "text", text: formattedLogs || "No logs available." }] }
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

	mcpServer.tool(
		"get_console_errors",
		{
			lines: z.number().optional().describe("Number of recent error lines. Default is 50."),
			includeWarnings: z.boolean().optional().describe("Include WARN level logs. Default is false."),
		},
		async ({ lines = 50, includeWarnings = false }) => {
			try {
				const snapshot = diagnosticsManager.getSnapshot()
				const levels = includeWarnings ? ["error", "warn"] : ["error"]
				const errorLogs = snapshot.logs.filter((l) => levels.includes(l.level)).slice(-Math.abs(lines))

				const formattedLogs = errorLogs
					.map((l) => `[${new Date(l.timestamp).toISOString()}][${l.level.toUpperCase()}] ${l.message}`)
					.join("\n")
				return { content: [{ type: "text", text: formattedLogs || "No errors found." }] }
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
}
