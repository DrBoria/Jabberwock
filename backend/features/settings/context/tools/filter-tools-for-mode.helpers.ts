import type OpenAI from "openai"
import type { ModeConfig, ToolName } from "@jabberwock/types"
import { defaultModeSlug } from "@shared/modes"
import { ALWAYS_AVAILABLE_TOOLS } from "@shared/tools/tools.groups"
import type { CodeIndexManager } from "@services/code-index/manager/manager"
import type { McpHub } from "@services/mcp/core/McpHub"
import { isToolAllowedForMode } from "@features/chat/tools"
import { getOrCreateRenamedTool, resolveToolAlias } from "./tool-alias-config"

/**
 * Result of applying model tool customization.
 * Contains the set of allowed tools and any alias renames to apply.
 */
export interface ModelToolCustomizationResult {
	allowedTools: Set<string>
	/** Maps canonical tool name to alias name for tools that should be renamed */
	aliasRenames: Map<string, string>
}

export function isCodeIndexReady(codeIndexManager?: CodeIndexManager): boolean {
	return !!(
		codeIndexManager &&
		codeIndexManager.isFeatureEnabled &&
		codeIndexManager.isFeatureConfigured &&
		codeIndexManager.isInitialized
	)
}

export function excludeCodebaseSearchIfDisabled(
	allowedToolNames: Set<string>,
	codeIndexManager?: CodeIndexManager,
): void {
	if (!isCodeIndexReady(codeIndexManager)) {
		allowedToolNames.delete("codebase_search")
	}
}

export function excludeToolIfExperimentDisabled(
	allowedToolNames: Set<string>,
	experiments: Record<string, boolean> | undefined,
	toolName: string,
	experimentKey: string,
): void {
	if (!experiments?.[experimentKey]) {
		allowedToolNames.delete(toolName)
	}
}

export function excludeDisabledTools(allowedToolNames: Set<string>, settings?: { [key: string]: unknown }): void {
	const disabledTools = (settings?.disabledTools ?? []) as string[]
	for (const toolName of disabledTools) {
		const resolvedToolName = resolveToolAlias(toolName)
		allowedToolNames.delete(resolvedToolName)
	}
}

export function excludeMcpResourceIfNotAvailable(allowedToolNames: Set<string>, mcpHub?: McpHub): void {
	if (!mcpHub || !hasAnyMcpResources(mcpHub)) {
		allowedToolNames.delete("access_mcp_resource")
	}
}

export function buildFilteredTools(
	nativeTools: OpenAI.Chat.ChatCompletionTool[],
	allowedToolNames: Set<string>,
	aliasRenames: Map<string, string>,
): OpenAI.Chat.ChatCompletionTool[] {
	const filteredTools: OpenAI.Chat.ChatCompletionTool[] = []

	for (const tool of nativeTools) {
		if (!("function" in tool) || !tool.function) {
			continue
		}

		const toolName = tool.function.name
		if (!allowedToolNames.has(toolName)) {
			continue
		}

		const aliasName = aliasRenames.get(toolName)
		if (aliasName) {
			filteredTools.push(getOrCreateRenamedTool(tool, aliasName))
		} else {
			filteredTools.push(tool)
		}
	}

	return filteredTools
}

/**
 * Helper function to check if any MCP server has resources available
 */
export function hasAnyMcpResources(mcpHub: McpHub): boolean {
	const servers = mcpHub.getServers()
	return servers.some((server) => server.resources && server.resources.length > 0)
}

export function isAlwaysAvailableToolAllowed(
	toolName: ToolName,
	experiments: Record<string, boolean> | undefined,
	codeIndexManager?: CodeIndexManager,
): boolean {
	if (toolName === "codebase_search") {
		return isCodeIndexReady(codeIndexManager)
	}

	if (toolName === "generate_image") {
		return experiments?.imageGeneration === true
	}

	if (toolName === "run_slash_command") {
		return experiments?.runSlashCommand === true
	}

	return true
}

/**
 * Checks if a specific tool is allowed in the current mode.
 * This is useful for dynamically filtering system prompt content.
 *
 * @param toolName - Name of the tool to check
 * @param mode - Current mode slug
 * @param customModes - Custom mode configurations
 * @param experiments - Experiment flags
 * @param codeIndexManager - Code index manager for codebase_search feature check
 * @param settings - Additional settings for tool filtering
 * @returns true if the tool is allowed in the mode, false otherwise
 */
export function isToolAllowedInMode(
	toolName: ToolName,
	mode: string | undefined,
	customModes: ModeConfig[] | undefined,
	experiments: Record<string, boolean> | undefined,
	codeIndexManager?: CodeIndexManager,
	_settings?: { [key: string]: unknown },
): boolean {
	const modeSlug = mode ?? defaultModeSlug

	if (ALWAYS_AVAILABLE_TOOLS.includes(toolName)) {
		return isAlwaysAvailableToolAllowed(toolName, experiments, codeIndexManager)
	}

	const canonicalTool = resolveToolAlias(toolName)
	return isToolAllowedForMode(
		canonicalTool as ToolName,
		modeSlug,
		customModes ?? [],
		undefined,
		undefined,
		experiments ?? {},
	)
}
