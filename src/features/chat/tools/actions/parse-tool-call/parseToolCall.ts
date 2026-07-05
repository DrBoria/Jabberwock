import { parseJSON } from "partial-json"

import { type ToolName, toolNames } from "@jabberwock/types"
import { customToolRegistry } from "@jabberwock/core"

import { type ToolUse, type McpToolUse, type ToolParamName, toolParamNames } from "@shared/tools"
import { resolveToolAlias } from "@features/settings/context/tools/tool-alias-config"
import { MCP_TOOL_PREFIX, MCP_TOOL_SEPARATOR, parseMcpToolName } from "@utils/mcp"

// ─── Internal helpers ───────────────────────────────────────────────────

function resolveAndValidateToolName(name: string): string | null {
	const resolved = resolveToolAlias(name)
	if (!toolNames.includes(resolved as ToolName) && !customToolRegistry.has(resolved)) {
		console.error(`[jabberwock] Invalid tool name: ${name} (resolved: ${resolved})`)
		console.error(`[jabberwock] Valid tool names:`, toolNames)
		return null
	}
	return resolved
}

function buildParamsFromArgs(
	args: Record<string, unknown>,
	resolvedName: string,
): Partial<Record<ToolParamName, string>> {
	const params: Partial<Record<ToolParamName, string>> = {}
	for (const [key, value] of Object.entries(args)) {
		if (!toolParamNames.includes(key as ToolParamName) && !customToolRegistry.has(resolvedName)) {
			console.warn(`[jabberwock] Unknown parameter '${key}' for tool '${resolvedName}'`)
			console.warn(`[jabberwock] Valid param names:`, toolParamNames)
			continue
		}
		params[key as ToolParamName] = typeof value === "string" ? value : JSON.stringify(value)
	}
	return params
}

// ─── Parse streaming partial tool call ──────────────────────────────────

/**
 * Parse a partial JSON accumulator and return a partial ToolUse.
 * Returns null if the partial JSON is too malformed to parse.
 * For dynamic MCP tools, returns null (wait for final).
 */
export function parsePartialToolCall(id: string, name: string, argumentsAccumulator: string): ToolUse | null {
	const mcpPrefix = MCP_TOOL_PREFIX + MCP_TOOL_SEPARATOR
	if (name.startsWith(mcpPrefix)) {
		return null
	}

	try {
		const partialArgs = parseJSON(argumentsAccumulator)
		const resolvedName = resolveToolAlias(name) as ToolName
		const originalName = name !== resolvedName ? name : undefined

		return createPartialToolUse(id, resolvedName, partialArgs || {}, true, originalName)
	} catch {
		return null
	}
}

function createPartialToolUse(
	id: string,
	name: ToolName,
	partialArgs: Record<string, unknown>,
	isPartial: boolean,
	originalName?: string,
): ToolUse {
	return {
		type: "tool_use",
		id,
		name,
		originalName,
		params: buildParamsFromArgs(partialArgs, name),
		partial: isPartial,
	}
}

function parseDynamicMcpTool(toolCall: { id: string; name: string; arguments: string }): McpToolUse | null {
	const parsed = parseMcpToolName(toolCall.name)
	if (!parsed) {
		return null
	}

	let args: Record<string, unknown> = {}
	try {
		args = JSON.parse(toolCall.arguments)
	} catch {
		try {
			const partial = parseJSON(toolCall.arguments)
			if (partial && typeof partial === "object") {
				args = partial as Record<string, unknown>
			}
		} catch {
			return null
		}
	}

	return {
		type: "mcp_tool_use",
		id: toolCall.id,
		name: toolCall.name,
		serverName: parsed.serverName,
		toolName: parsed.toolName,
		arguments: args,
		partial: false,
	}
}

/**
 * Finalize a streaming tool call — parse the complete accumulated JSON
 * and return the final ToolUse or McpToolUse.
 */
export function parseFinalToolCall(
	id: string,
	name: string,
	argumentsAccumulator: string,
): ToolUse | McpToolUse | null {
	const resolvedName = resolveAndValidateToolName(name)
	if (!resolvedName) {
		return null
	}

	if (resolvedName.startsWith(MCP_TOOL_PREFIX + MCP_TOOL_SEPARATOR)) {
		return parseDynamicMcpTool({ id, name: resolvedName, arguments: argumentsAccumulator })
	}

	try {
		const args = parseJSON(argumentsAccumulator)
		if (!args || typeof args !== "object") {
			return null
		}
		const recordArgs = args as Record<string, unknown>
		const paramArgs = buildParamsFromArgs(recordArgs, resolvedName)
		const originalName = name !== resolvedName ? name : undefined

		return {
			type: "tool_use",
			id,
			name: resolvedName as ToolName,
			originalName,
			params: paramArgs,
			partial: false,
		} satisfies ToolUse
	} catch {
		return null
	}
}

/**
 * Parse a complete (non-streaming) tool call from the API response.
 */
export function parseToolCall(params: { id: string; name: string; arguments: string }): ToolUse | null {
	const { id, name, arguments: args } = params
	const resolvedName = resolveAndValidateToolName(name)
	if (!resolvedName) {
		return null
	}

	if (resolvedName.startsWith(MCP_TOOL_PREFIX + MCP_TOOL_SEPARATOR)) {
		return null
	}

	try {
		const parsedArgs = JSON.parse(args) as Record<string, unknown>
		const paramArgs = buildParamsFromArgs(parsedArgs, resolvedName)
		const originalName = name !== resolvedName ? name : undefined

		return {
			type: "tool_use",
			id,
			name: resolvedName as ToolName,
			originalName,
			params: paramArgs,
			partial: false,
		} satisfies ToolUse
	} catch {
		return null
	}
}
