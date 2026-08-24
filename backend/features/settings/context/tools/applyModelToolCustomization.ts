import type { ModeConfig, ToolGroup, ModelInfo } from "@jabberwock/types"
import { TOOL_GROUPS } from "@shared/tools/tools.groups"
import { resolveToolAlias } from "./tool-alias-config"
import type { ModelToolCustomizationResult } from "./filter-tools-for-mode.helpers"

/**
 * Apply model-specific tool customization to a set of allowed tools.
 *
 * This function filters tools based on model configuration:
 * 1. Removes tools specified in modelInfo.excludedTools
 * 2. Adds tools from modelInfo.includedTools (only if they belong to allowed groups)
 *
 * @param allowedTools - Set of tools already allowed by mode configuration
 * @param modeConfig - Current mode configuration to check tool groups
 * @param modelInfo - Model configuration with tool customization
 * @returns Modified set of tools after applying model customization
 */
export function applyModelToolCustomization(
	allowedTools: Set<string>,
	modeConfig: ModeConfig,
	modelInfo?: ModelInfo,
): ModelToolCustomizationResult {
	if (!modelInfo) {
		return { allowedTools, aliasRenames: new Map() }
	}

	const result = new Set(allowedTools)
	const aliasRenames = new Map<string, string>()

	// Apply excluded tools (remove from allowed set)
	if (modelInfo.excludedTools && modelInfo.excludedTools.length > 0) {
		modelInfo.excludedTools.forEach((tool) => {
			const resolvedTool = resolveToolAlias(tool)
			result.delete(resolvedTool)
		})
	}

	// Apply included tools (add to allowed set, but only if they belong to an allowed group)
	if (modelInfo.includedTools && modelInfo.includedTools.length > 0) {
		// Build a map of tool -> group for all tools in TOOL_GROUPS (including customTools)
		const toolToGroup = new Map<string, ToolGroup>()
		for (const [groupName, groupConfig] of Object.entries(TOOL_GROUPS)) {
			// Add regular tools
			groupConfig.tools.forEach((tool) => {
				toolToGroup.set(tool, groupName as ToolGroup)
			})
			// Add customTools (opt-in only tools)
			if (groupConfig.customTools) {
				groupConfig.customTools.forEach((tool) => {
					toolToGroup.set(tool, groupName as ToolGroup)
				})
			}
		}

		// Get the list of allowed groups for this mode
		const allowedGroups = new Set(
			modeConfig.groups.map((groupEntry) => (Array.isArray(groupEntry) ? groupEntry[0] : groupEntry)),
		)

		// Add included tools only if they belong to an allowed group
		// If the tool was specified as an alias, track the rename
		modelInfo.includedTools.forEach((tool) => {
			const resolvedTool = resolveToolAlias(tool)
			const toolGroup = toolToGroup.get(resolvedTool)
			if (toolGroup && allowedGroups.has(toolGroup)) {
				result.add(resolvedTool)
				// If the tool was specified as an alias, rename it in the API
				if (tool !== resolvedTool) {
					aliasRenames.set(resolvedTool, tool)
				}
			}
		})
	}

	return { allowedTools: result, aliasRenames }
}
