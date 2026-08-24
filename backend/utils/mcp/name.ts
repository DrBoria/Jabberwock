/**
 * Utilities for sanitizing MCP server and tool names to conform to
 * API function name requirements across all providers.
 */

/**
 * Separator used between MCP prefix, server name, and tool name.
 * We use "--" (double hyphen) because:
 * 1. It's allowed by all providers (dashes are permitted in function names)
 * 2. It won't conflict with underscores in sanitized server/tool names
 * 3. It's unique enough to be a reliable delimiter for parsing
 */
export const MCP_TOOL_SEPARATOR = "--"

/**
 * Prefix for all MCP tool function names.
 */
export const MCP_TOOL_PREFIX = "mcp"

/**
 * Normalize a string for comparison by treating hyphens and underscores as equivalent.
 * This is used to match tool names when models convert hyphens to underscores.
 *
 * @param name - The name to normalize
 * @returns The normalized name with all hyphens converted to underscores
 */
export function normalizeMcpToolName(name: string): string {
	const normalized = name.replace(/-/g, "_")
	return normalized
}

/**
 * Check if a tool name is an MCP tool (starts with the MCP prefix + separator).
 *
 * @param name - The tool function name to check
 * @returns True if the name matches the MCP tool pattern
 */
export function isMcpTool(name: string): boolean {
	const result = name.startsWith(MCP_TOOL_PREFIX + MCP_TOOL_SEPARATOR)
	return result
}

/**
 * Sanitize an MCP server or tool name to be a valid function name component.
 * Replaces any character that is not alphanumeric, underscore, or hyphen with an underscore.
 *
 * @param name - The name to sanitize
 * @returns The sanitized name safe for use in API function names
 */
export function sanitizeMcpName(name: string): string {
	const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, "_")
	return sanitized
}

/**
 * Build a full MCP tool function name from server name and tool name.
 *
 * Format: mcp--{sanitizedServerName}--{sanitizedToolName}
 *
 * @param serverName - The MCP server name
 * @param toolName - The tool name
 * @returns The full MCP tool function name
 */
export function buildMcpToolName(serverName: string, toolName: string): string {
	const sanitizedServer = sanitizeMcpName(serverName)
	const sanitizedTool = sanitizeMcpName(toolName)
	return `${MCP_TOOL_PREFIX}${MCP_TOOL_SEPARATOR}${sanitizedServer}${MCP_TOOL_SEPARATOR}${sanitizedTool}`
}

/**
 * Parse a full MCP tool function name into its server and tool components.
 *
 * Expected format: mcp--{serverName}--{toolName}
 *
 * @param name - The full MCP tool function name
 * @returns An object with serverName and toolName, or null if the name is not a valid MCP tool name
 */
export function parseMcpToolName(name: string): { serverName: string; toolName: string } | null {
	if (!isMcpTool(name)) {
		return null
	}
	const withoutPrefix = name.slice((MCP_TOOL_PREFIX + MCP_TOOL_SEPARATOR).length)
	const separatorIndex = withoutPrefix.indexOf(MCP_TOOL_SEPARATOR)
	if (separatorIndex === -1) {
		return null
	}
	return {
		serverName: withoutPrefix.slice(0, separatorIndex),
		toolName: withoutPrefix.slice(separatorIndex + MCP_TOOL_SEPARATOR.length),
	}
}

/**
 * Check if two tool names match, treating hyphens and underscores as equivalent.
 * Both names are normalized before comparison.
 *
 * @param a - First tool name
 * @param b - Second tool name
 * @returns True if the names match after normalization
 */
export function toolNamesMatch(a: string, b: string): boolean {
	return normalizeMcpToolName(a) === normalizeMcpToolName(b)
}
