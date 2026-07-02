import { z } from "zod"
import * as vscode from "vscode"

// ─── Error messages ──────────────────────────────────────────────────

export const typeErrorMessage = "Server type must be 'stdio', 'sse', 'websocket', or 'streamable-http'"
export const stdioFieldsErrorMessage =
	"For 'stdio' type servers, you must provide a 'command' field and can optionally include 'args' and 'env'"
export const sseFieldsErrorMessage =
	"For 'sse' type servers, you must provide a 'url' field and can optionally include 'headers'"
export const streamableHttpFieldsErrorMessage =
	"For 'streamable-http' type servers, you must provide a 'url' field and can optionally include 'headers'"
export const mixedFieldsErrorMessage =
	"Cannot mix 'stdio' and ('sse', 'websocket', or 'streamable-http') fields. For 'stdio' use 'command', 'args', and 'env'. For 'sse'/'websocket'/'streamable-http' use 'url' and 'headers'"
export const missingFieldsErrorMessage =
	"Server configuration must include either 'command' (for stdio) or 'url' (for sse/websocket/streamable-http) and a corresponding 'type' if 'url' is used."

// ─── Disable reason enum ─────────────────────────────────────────────

export enum DisableReason {
	MCP_DISABLED = "mcpDisabled",
	SERVER_DISABLED = "serverDisabled",
}

// ─── Zod schemas ─────────────────────────────────────────────────────

export const BaseConfigSchema = z
	.object({
		disabled: z.boolean().optional(),
		timeout: z.number().min(1).max(3600).optional().default(60),
		alwaysAllow: z.array(z.string()).default([]),
		watchPaths: z.array(z.string()).optional(),
		disabledTools: z.array(z.string()).default([]),
	})
	.passthrough()

// ─── Re-exports ─────────────────────────────────────────────────────

import { mcpSettingsSchema, mcpServerTypeSchema } from "@jabberwock/types"

export const ServerConfigSchema = BaseConfigSchema

/** Schema for MCP settings file structure (mcpServers map) */
export const McpSettingsSchema = mcpSettingsSchema

/** Schema for the MCP server type field ("tool" | "interactiveApp") */
export const createServerTypeSchema = mcpServerTypeSchema
