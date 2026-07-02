import { z } from "zod"
import { McpSettings, mcpSettingsSchema } from "@packages/types/src/mcp"

/**
 * Migrates legacy MCP settings to Jabberwock format
 * This utility ensures that old mcp_settings.json files continue to work
 * while adding default values for the new Jabberwock features
 */
function _migrateServerEntry(key: string, config: unknown): unknown {
	if (config && typeof config === "object") {
		const configObj = config as Record<string, unknown>
		return {
			...configObj,
			isGloballyVisible: configObj.isGloballyVisible,
			type: configObj.type ?? "tool",
			allowedContext: Array.isArray(configObj.allowedContext) ? configObj.allowedContext : [],
			alwaysAllow: Array.isArray(configObj.alwaysAllow) ? configObj.alwaysAllow : [],
			disabledTools: Array.isArray(configObj.disabledTools) ? configObj.disabledTools : [],
		}
	}
	return config
}

export function migrateMcpSettings(rawSettings: unknown): McpSettings {
	if (!rawSettings || typeof rawSettings !== "object") {
		return { mcpServers: {} }
	}

	const settings = rawSettings as Record<string, unknown>
	const servers = (settings.mcpServers as Record<string, unknown>) || {}

	const migratedServers: Record<string, unknown> = {}

	for (const [key, config] of Object.entries(servers)) {
		migratedServers[key] = _migrateServerEntry(key, config)
	}

	const result = mcpSettingsSchema.safeParse({ mcpServers: migratedServers })

	if (!result.success) {
		console.error("[jabberwock] Failed to migrate MCP settings", result.error)
		return { mcpServers: {} }
	}

	return result.data
}

/**
 * Validates MCP settings against the Jabberwock schema
 * Returns both the validated settings and any validation errors
 */
export function validateMcpSettings(settings: unknown): {
	success: boolean
	data?: McpSettings
	errors?: string[]
} {
	const result = mcpSettingsSchema.safeParse(settings)

	if (!result.success) {
		return {
			success: false,
			errors: result.error.errors.map((err: z.ZodIssue) => `${err.path.join(".")}: ${err.message}`),
		}
	}

	return {
		success: true,
		data: result.data,
	}
}

/**
 * Helper to check if a server configuration requires user interaction
 * This is used by the state machine to determine if auto-approval should be blocked
 */
export function requiresUserInteraction(serverConfig: Record<string, unknown>): boolean {
	return serverConfig?.requiresUserInteraction === true || serverConfig?.type === "interactiveApp"
}

/**
 * Helper to check if a server should be visible to a specific agent
 * Based on the per-agent MCP isolation strategy
 */
export function isServerVisibleToAgent(
	serverName: string,
	serverConfig: Record<string, unknown>,
	agentMcpList?: string[],
): boolean {
	if (serverConfig?.disabled) {
		return false
	}

	// If the mode doesn't define an mcpList restrictor at all,
	// it gets access to everything UNLESS the server is explicitly hidden.
	if (!agentMcpList) {
		const visible = serverConfig?.isGloballyVisible !== false
		return visible
	}

	// If the mode DOES define an mcpList, it acts as a strict allowlist:
	// Only explicitly global servers + servers in the list are allowed.
	if (serverConfig?.isGloballyVisible === true) {
		return true
	}

	const inList = agentMcpList.includes(serverName)
	return inList
}
