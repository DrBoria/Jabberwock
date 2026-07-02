import type OpenAI from "openai"
import { TOOL_ALIASES } from "@shared/tools/tools.groups"

/**
 * Reverse lookup map - maps alias name to canonical tool name.
 * Built once at module load from the central TOOL_ALIASES constant.
 */
export const ALIAS_TO_CANONICAL: Map<string, string> = new Map(
	Object.entries(TOOL_ALIASES).map(([alias, canonical]) => [alias, canonical]),
)

/**
 * Canonical to aliases map - maps canonical tool name to array of alias names.
 * Built once at module load from the central TOOL_ALIASES constant.
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
export const ALIAS_GROUPS: Map<string, readonly string[]> = new Map()

// Build alias groups for all tools
for (const [canonical, aliases] of CANONICAL_TO_ALIASES.entries()) {
	const group = Object.freeze([canonical, ...aliases])
	// Map canonical to group
	ALIAS_GROUPS.set(canonical, group)
	// Map each alias to the same group
	for (const alias of aliases) {
		ALIAS_GROUPS.set(alias, group)
	}
}

/**
 * Cache for renamed tool definitions.
 * Maps "canonicalName:aliasName" to the pre-built tool definition.
 * This avoids creating new objects via spread operators on every assistant message.
 */
export const RENAMED_TOOL_CACHE: Map<string, OpenAI.Chat.ChatCompletionTool> = new Map()

/**
 * Gets or creates a renamed tool definition with the alias name.
 * Uses RENAMED_TOOL_CACHE to avoid repeated object allocation.
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
	let renamedTool = RENAMED_TOOL_CACHE.get(cacheKey)

	if (!renamedTool) {
		renamedTool = {
			...tool,
			function: {
				...tool.function,
				name: aliasName,
			},
		}
		RENAMED_TOOL_CACHE.set(cacheKey, renamedTool)
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
	const canonical = ALIAS_TO_CANONICAL.get(toolName)
	return canonical ?? toolName
}
