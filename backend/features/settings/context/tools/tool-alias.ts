import type OpenAI from "openai"
import { TOOL_ALIASES } from "@shared/tools/groups"

/**
 * Reverse lookup map - maps alias name to canonical tool name.
 * Built once at module load from "the" central TOOL_ALIASES constant.
 */
const __moduleState = {
	ALIAS_TO_CANONICAL: new Map(Object.entries(TOOL_ALIASES).map(([alias, canonical]) => [alias, canonical])) as Map<
		string,
		string
	>,
	RENAMED_TOOL_CACHE: new Map() as Map<string, OpenAI.Chat.ChatCompletionTool>,
}
export const { ALIAS_TO_CANONICAL } = __moduleState
export const { RENAMED_TOOL_CACHE } = __moduleState

/**
 * Canonical to aliases map - maps canonical tool name to array of alias names.
 * Built once at module load from "the" central TOOL_ALIASES constant.
 */
export const CANONICAL_TO_ALIASES: Map<string, string[]> = new Map()

// Build the reverse mapping (canonical -> aliases)
for (const [alias, canonical] of Object.entries(TOOL_ALIASES)) {
	const existing = CANONICAL_TO_ALIASES.get(canonical) ?? []
	existing.push(alias)
	CANONICAL_TO_ALIASES.set(canonical, existing)
}

/**
 * Pre-computed alias groups map - maps any tool name (canonical or alias) to its full group.
 * Built once at module load for O(1) lookup.
 */
function buildAliasGroups(canonicalToAliases: Map<string, string[]>): Map<string, readonly string[]> {
	const groups = new Map<string, readonly string[]>()
	for (const [canonical, aliases] of canonicalToAliases.entries()) {
		const group = Object.freeze([canonical, ...aliases])
		// Map canonical to group
		groups.set(canonical, group)
		// Map each alias to the same group
		for (const alias of aliases) {
			groups.set(alias, group)
		}
	}
	return groups
}

export const ALIAS_GROUPS: Map<string, readonly string[]> = buildAliasGroups(CANONICAL_TO_ALIASES)

/**
 * Cache for renamed tool definitions.
 * Maps "canonicalName:aliasName" to the pre-built tool definition.
 * This avoids creating new objects via spread operators on every assistant message.
 */
/**
 * Gets or creates a renamed tool definition with the alias name.
 * Uses __moduleState.RENAMED_TOOL_CACHE to avoid repeated object allocation.
 *
 * @param tool - The original tool definition
 * @param aliasName - The alias name to use
 * @returns Cached or newly created renamed tool definition
 */
export function getOrCreateRenamedTool(
	tool: OpenAI.Chat.ChatCompletionTool,
	aliasName: string,
): OpenAI.Chat.ChatCompletionTool {
	if (!("function" in tool) || !tool.function) {
		return tool
	}

	const cacheKey = `${tool.function.name}:${aliasName}`
	let renamedTool = __moduleState.RENAMED_TOOL_CACHE.get(cacheKey)

	if (!renamedTool) {
		renamedTool = {
			...tool,
			function: {
				...tool.function,
				name: aliasName,
			},
		}
		__moduleState.RENAMED_TOOL_CACHE.set(cacheKey, renamedTool)
	}

	return renamedTool
}

/**
 * Resolves a tool name to its canonical name.
 * If the tool name is an alias, returns the canonical tool name.
 * If it's already a canonical name or unknown, returns as-is.
 *
 * @param toolName - The tool name to resolve (may be an alias)
 * @returns The canonical tool name
 */
export function resolveToolAlias(toolName: string): string {
	const canonical = __moduleState.ALIAS_TO_CANONICAL.get(toolName)
	return canonical ?? toolName
}

/**
 * Applies tool alias resolution to a set of allowed tools.
 * Resolves any aliases to their canonical tool names.
 *
 * @param allowedTools - Set of tools that may contain aliases
 * @returns Set with aliases resolved to canonical names
 */
export function applyToolAliases(allowedTools: Set<string>): Set<string> {
	const result = new Set<string>()

	for (const tool of allowedTools) {
		result.add(resolveToolAlias(tool))
	}

	return result
}

/**
 * Gets all tools in an alias group (including the canonical tool).
 * Uses pre-computed ALIAS_GROUPS map for O(1) lookup.
 *
 * @param toolName - Any tool name in the alias group
 * @returns Array of all tool names in the alias group, or just the tool if not aliased
 */
export function getToolAliasGroup(toolName: string): readonly string[] {
	return ALIAS_GROUPS.get(toolName) ?? [toolName]
}
