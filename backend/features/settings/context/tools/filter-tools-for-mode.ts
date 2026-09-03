import type OpenAI from "openai"
import type { ModeConfig, ToolName, ToolGroup, ModelInfo } from "@jabberwock/types"
import { getModeBySlug, getToolsForMode, defaultModeSlug } from "@shared/modes"
import { TOOL_GROUPS } from "@shared/tools/tools.groups"
import type { CodeIndexManager } from "@services/code-index/manager/manager"
import type { McpHub } from "@services/mcp/core/McpHub"
import { isToolAllowedForMode } from "@features/chat/tools"
import {
	buildFilteredTools,
	excludeCodebaseSearchIfDisabled,
	excludeToolIfExperimentDisabled,
	excludeDisabledTools,
	excludeMcpResourceIfNotAvailable,
	isToolAllowedInMode,
} from "./filter-tools-for-mode.helpers"
import { applyModelToolCustomization } from "./applyModelToolCustomization"

/**
 * Filters native tools based on mode restrictions and model customization.
 * This ensures native tools are filtered consistently with mode/tool permissions.
 *
 * @param nativeTools - Array of all available native tools
 * @param mode - Current mode slug
 * @param customModes - Custom mode configurations
 * @param experiments - Experiment flags
 * @param codeIndexManager - Code index manager for codebase_search feature check
 * @param settings - Additional settings for tool filtering (includes modelInfo for model-specific customization)
 * @param mcpHub - MCP hub for checking available resources
 * @returns Filtered array of tools allowed for the mode
 */
export function filterNativeToolsForMode(
	nativeTools: OpenAI.Chat.ChatCompletionTool[],
	mode: string | undefined,
	customModes: ModeConfig[] | undefined,
	experiments: Record<string, boolean> | undefined,
	codeIndexManager?: CodeIndexManager,
	settings?: { [key: string]: unknown },
	mcpHub?: McpHub,
): OpenAI.Chat.ChatCompletionTool[] {
	const modeSlug = mode ?? defaultModeSlug
	let modeConfig = getModeBySlug(modeSlug, customModes)

	if (!modeConfig) {
		modeConfig = getModeBySlug(defaultModeSlug, customModes)!
	}

	const allToolsForMode = getToolsForMode(modeConfig.groups)

	let allowedToolNames = new Set(
		allToolsForMode.filter((tool) =>
			isToolAllowedForMode(
				tool as ToolName,
				modeSlug,
				customModes ?? [],
				undefined,
				undefined,
				experiments ?? {},
			),
		),
	)

	const modelInfo = settings?.modelInfo as ModelInfo | undefined
	const { allowedTools: customizedTools, aliasRenames } = applyModelToolCustomization(
		allowedToolNames,
		modeConfig,
		modelInfo,
	)
	allowedToolNames = customizedTools

	excludeCodebaseSearchIfDisabled(allowedToolNames, codeIndexManager)
	excludeToolIfExperimentDisabled(allowedToolNames, experiments, "generate_image", "imageGeneration")
	excludeToolIfExperimentDisabled(allowedToolNames, experiments, "run_slash_command", "runSlashCommand")
	// ICG-C2 context graph tools - DEFAULT OFF until ICG-F sign-off (experiment flag: contextGraphTools).
	excludeToolIfExperimentDisabled(allowedToolNames, experiments, "context_search", "contextGraphTools")
	excludeToolIfExperimentDisabled(allowedToolNames, experiments, "context_recall", "contextGraphTools")
	excludeDisabledTools(allowedToolNames, settings)
	excludeMcpResourceIfNotAvailable(allowedToolNames, mcpHub)

	return buildFilteredTools(nativeTools, allowedToolNames, aliasRenames)
}

/**
 * Gets the list of available tools from a specific tool group for the current mode.
 * This is useful for dynamically building system prompt content based on available tools.
 *
 * @param groupName - Name of the tool group to check
 * @param mode - Current mode slug
 * @param customModes - Custom mode configurations
 * @param experiments - Experiment flags
 * @param codeIndexManager - Code index manager for codebase_search feature check
 * @param settings - Additional settings for tool filtering
 * @returns Array of tool names that are available from the group
 */
export function getAvailableToolsInGroup(
	groupName: ToolGroup,
	mode: string | undefined,
	customModes: ModeConfig[] | undefined,
	experiments: Record<string, boolean> | undefined,
	codeIndexManager?: CodeIndexManager,
	settings?: { [key: string]: unknown },
): ToolName[] {
	const toolGroup = TOOL_GROUPS[groupName]
	if (!toolGroup) {
		return []
	}

	return toolGroup.tools.filter((tool) =>
		isToolAllowedInMode(tool as ToolName, mode, customModes, experiments, codeIndexManager, settings),
	) as ToolName[]
}

/**
 * Filters MCP tools based on whether use_mcp_tool is allowed in the current mode.
 *
 * @param mcpTools - Array of MCP tools
 * @param mode - Current mode slug
 * @param customModes - Custom mode configurations
 * @param experiments - Experiment flags
 * @returns Filtered array of MCP tools if use_mcp_tool is allowed, empty array otherwise
 */
export function filterMcpToolsForMode(
	mcpTools: OpenAI.Chat.ChatCompletionTool[],
	mode: string | undefined,
	customModes: ModeConfig[] | undefined,
	experiments: Record<string, boolean> | undefined,
): OpenAI.Chat.ChatCompletionTool[] {
	const modeSlug = mode ?? defaultModeSlug

	const isMcpAllowed = isToolAllowedForMode(
		"use_mcp_tool",
		modeSlug,
		customModes ?? [],
		undefined,
		undefined,
		experiments ?? {},
	)

	return isMcpAllowed ? mcpTools : []
}
