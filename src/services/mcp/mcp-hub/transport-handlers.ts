import type { Stream } from "stream"

import type { McpHubState } from "@services/mcp/core/types"
import { findConnection, appendErrorMessage } from "./connection/manager"
import { notifyWebviewOfServerChanges } from "./notifications"
import { getProjectMcpPath } from "./init"
import { diagnosticsManager } from "@jabberwock/devtool"
import { getMcpSettingsFilePath as getMcpSettingsFilePathFromConfig } from "@services/mcp"

// ─── Setup Stdio stderr handler ──────────────────────────────────────

export function setupStdioStderr(
	state: McpHubState,
	transport: { stderr?: Stream | null },
	name: string,
	source: "global" | "project",
): void {
	const stderrStream = transport.stderr
	if (stderrStream) {
		stderrStream.on("data", async (data: Buffer) => {
			const output = data.toString()
			const TODO_LOG_PREFIX = "[TODO-LOG]"
			if (output.includes(TODO_LOG_PREFIX)) {
				const lines = output.split("\n")
				for (const line of lines) {
					const prefixIdx = line.indexOf(TODO_LOG_PREFIX)
					if (prefixIdx !== -1) {
						const jsonStr = line.slice(prefixIdx + TODO_LOG_PREFIX.length).trim()
						try {
							const logEntry = JSON.parse(jsonStr)
							diagnosticsManager.log(
								`[TODO-LOG:${logEntry.event}] ${JSON.stringify(logEntry.data)}`,
								"info",
							)
						} catch {
							// ignore parse errors
						}
					}
				}
				console.log(`Server "${name}" todo-log:`, output)
				return
			}
			const isInfoLog = /INFO/i.test(output)
			if (isInfoLog) {
				console.log(`Server "${name}" info:`, output)
			} else {
				console.error(`[jabberwock] Server "${name}" stderr:`, output)
				const connection = findConnection(state, name, source)
				if (connection) {
					appendErrorMessage(connection, output)
					if (connection.server.status === "disconnected") {
						const getMcpSettingsFilePath = async (): Promise<string> => {
							return getMcpSettingsFilePathFromConfig(state._context)
						}
						await notifyWebviewOfServerChanges(state, getMcpSettingsFilePath, getProjectMcpPath)
					}
				}
			}
		})
	} else {
		console.error(`[jabberwock] No stderr stream for ${name}`)
	}
}

// ─── Setup elicitation handler ───────────────────────────────────────

export function setupElicitationHandler(
	client: import("@modelcontextprotocol/sdk/client/index.js").Client,
	state: McpHubState,
): void {
	const { z } = require("zod") as typeof import("zod")
	const ElicitationRequestSchema = z.object({
		method: z.literal("elicitation/create"),
		params: z
			.object({
				_meta: z
					.object({
						ui: z
							.object({
								resourceUri: z.string(),
							})
							.optional(),
					})
					.optional(),
			})
			.passthrough()
			.optional(),
	})

	client.setRequestHandler(ElicitationRequestSchema, async (request: unknown) => {
		return new Promise((resolve, reject) => {
			const params = (request as { params?: { _meta?: { ui?: { resourceUri?: string } } } }).params
			console.log("[Jabberwock] Elicitation requested:", params?._meta?.ui?.resourceUri)
			const resourceUri = params?._meta?.ui?.resourceUri
			if (resourceUri) {
				// eslint-disable-next-line no-restricted-syntax -- Emit not on McpHubState type but runtime object has it
				;(state as unknown as { emit: (event: string, data: unknown) => void }).emit("interactiveUiRequested", {
					uri: resourceUri,
					resolve,
					reject,
				})
			} else {
				reject(new Error("No UI resource URI provided"))
			}
		})
	})
}
