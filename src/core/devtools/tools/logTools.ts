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
			lines: z
				.number()
				.optional()
				.describe("Number of recent lines. Default is all. Use negative for from start (e.g. -10 = first 10)."),
			level: z
				.enum(["info", "warn", "error", "debug"])
				.optional()
				.describe("Filter by log level. Default is all levels."),
			excludePattern: z
				.string()
				.optional()
				.describe("Exclude lines matching this substring (e.g. 'DEBUG: PROMPT' to hide prompt debug logs)."),
			search: z
				.string()
				.optional()
				.describe(
					"Filter logs by keyword/substring (case-insensitive). Only lines containing this string will be returned.",
				),
			offset: z
				.number()
				.optional()
				.describe("Skip this many lines from the start (for pagination). Default is 0."),
			limit: z
				.number()
				.optional()
				.describe(
					"Maximum number of lines to return after offset (for pagination). Overrides `lines` when set.",
				),
		},
		async ({ lines, level, excludePattern, search, offset, limit }) => {
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

				// Filter by search keyword
				if (search) {
					const searchLower = search.toLowerCase()
					filteredLogs = filteredLogs.filter((l) => l.message.toLowerCase().includes(searchLower))
				}

				// Pagination: offset + limit takes priority over lines
				if (limit !== undefined) {
					const start = offset ?? 0
					filteredLogs = filteredLogs.slice(start, start + limit)
				} else if (lines !== undefined && lines < 0) {
					// Negative lines = first N
					filteredLogs = filteredLogs.slice(0, Math.abs(lines))
				} else if (lines && lines > 0) {
					// Positive lines = last N (default behavior)
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
			lines: z
				.number()
				.optional()
				.describe(
					"Number of recent error lines to return from the end. Default is 50. Use negative for from start (e.g. -10 = first 10).",
				),
			includeWarnings: z.boolean().optional().describe("Include WARN level logs. Default is false."),
			search: z
				.string()
				.optional()
				.describe(
					"Filter logs by keyword/substring (case-insensitive). Only lines containing this string will be returned.",
				),
			offset: z
				.number()
				.optional()
				.describe("Skip this many lines from the start (for pagination). Default is 0."),
			limit: z
				.number()
				.optional()
				.describe(
					"Maximum number of lines to return after offset (for pagination). Overrides `lines` when set.",
				),
		},
		async ({ lines = 50, includeWarnings = false, search, offset, limit }) => {
			try {
				const snapshot = diagnosticsManager.getSnapshot()
				const levels = includeWarnings ? ["error", "warn"] : ["error"]
				let errorLogs = snapshot.logs.filter((l) => levels.includes(l.level))

				// Filter by search keyword
				if (search) {
					const searchLower = search.toLowerCase()
					errorLogs = errorLogs.filter((l) => l.message.toLowerCase().includes(searchLower))
				}

				// Pagination: offset + limit takes priority over lines
				if (limit !== undefined) {
					const start = offset ?? 0
					errorLogs = errorLogs.slice(start, start + limit)
				} else if (lines < 0) {
					// Negative lines = first N
					errorLogs = errorLogs.slice(0, Math.abs(lines))
				} else {
					// Positive lines = last N (default behavior)
					errorLogs = errorLogs.slice(-Math.abs(lines))
				}

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
