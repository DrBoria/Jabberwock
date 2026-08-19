import type { ToolName, ModeConfig, ExperimentId, GroupOptions, GroupEntry } from "@jabberwock/types"
import { toolNames as validToolNames } from "@jabberwock/types"
import { customToolRegistry } from "@jabberwock/core"

import { type Mode, FileRestrictionError, getModeBySlug, getGroupName } from "@shared/modes"
import { EXPERIMENT_IDS } from "@shared/experiments"
import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS, TOOL_ALIASES } from "@shared/tools/tools.groups"
import { agentStore } from "@features/settings/agents/store/index"

export function isValidToolName(toolName: string, experiments?: Record<string, boolean>): toolName is ToolName {
	if ((validToolNames as readonly string[]).includes(toolName)) return true
	if (experiments?.customTools && customToolRegistry.has(toolName)) return true
	if (toolName.startsWith("mcp_")) return true
	return false
}

export function validateToolUse(
	toolName: ToolName,
	mode: Mode,
	customModes?: ModeConfig[],
	toolRequirements?: Record<string, boolean>,
	toolParams?: { [key: string]: unknown },
	experiments?: Record<string, boolean>,
	includedTools?: string[],
): void {
	if (!isValidToolName(toolName, experiments)) {
		throw new Error(
			`Unknown tool "${toolName}". This tool does not exist. Please use one of the available tools: ${validToolNames.join(", ")}.`,
		)
	}
	if (
		!isToolAllowedForMode(
			toolName,
			mode,
			customModes ?? [],
			toolRequirements,
			toolParams,
			experiments,
			includedTools,
		)
	) {
		throw new Error(`Tool "${toolName}" is not allowed in ${mode} mode.`)
	}
	const agent = agentStore.agents.get(typeof mode === "string" ? mode : (mode as { slug: string }).slug)
	if (agent && !agent.canUseTool(toolName)) {
		throw new Error(`Agent profile "${agent.name}" (${agent.role}) is not authorized to use tool "${toolName}".`)
	}
}

const EDIT_OPERATION_PARAMS = [
	"diff",
	"content",
	"operations",
	"search",
	"replace",
	"args",
	"line",
	"patch",
	"old_string",
	"new_string",
] as const
const PATCH_FILE_MARKERS = ["*** Add File: ", "*** Delete File: ", "*** Update File: "] as const

export function extractFilePathsFromPatch(patchContent: string): string[] {
	const filePaths: string[] = []
	for (const line of patchContent.split("\n")) {
		for (const marker of PATCH_FILE_MARKERS) {
			if (line.startsWith(marker)) {
				const path = line.substring(marker.length).trim()
				if (path) filePaths.push(path)
				break
			}
		}
	}
	return filePaths
}

export function getGroupOptions(group: GroupEntry): GroupOptions | undefined {
	return Array.isArray(group) ? group[1] : undefined
}

export function doesFileMatchRegex(filePath: string, pattern: string): boolean {
	try {
		return new RegExp(pattern).test(filePath)
	} catch (error) {
		console.error(`[jabberwock] Invalid regex pattern: ${pattern}`, error)
		return false
	}
}

export function isToolDisabledByRequirements(
	tool: string,
	resolvedTool: string,
	toolRequirements?: Record<string, boolean> | false,
): boolean {
	if (toolRequirements === false) return true
	if (!toolRequirements) return false
	if (tool in toolRequirements && !toolRequirements[tool]) return true
	if (resolvedTool in toolRequirements && !toolRequirements[resolvedTool]) return true
	return false
}

export function isAlwaysAllowedTool(
	tool: string,
	_resolvedTool: string,
	experiments?: Record<string, boolean>,
): boolean {
	if (ALWAYS_AVAILABLE_TOOLS.includes(tool as (typeof ALWAYS_AVAILABLE_TOOLS)[number])) return true
	if (experiments?.customTools && customToolRegistry.has(tool)) return true
	return false
}

export function isExperimentDisabled(tool: string, experiments?: Record<string, boolean>): boolean {
	if (!experiments) return false
	if (!Object.values(EXPERIMENT_IDS).includes(tool as ExperimentId)) return false
	return !experiments[tool]
}

export function isEditFilePathValid(
	tool: string,
	toolParams: Record<string, unknown> | undefined,
	options: GroupOptions,
	mode: ModeConfig,
): boolean {
	const filePath = (toolParams?.path ?? toolParams?.file_path) as string | undefined
	const isEditOperation = EDIT_OPERATION_PARAMS.some((param) => toolParams?.[param])
	if (!filePath || !isEditOperation) return false
	if (!doesFileMatchRegex(filePath!, options.fileRegex!)) {
		throw new FileRestrictionError(mode.name, options.fileRegex!, options.description, filePath!, tool)
	}
	return true
}

export function validateApplyPatchPaths(
	tool: string,
	toolParams: Record<string, unknown> | undefined,
	options: GroupOptions,
	mode: ModeConfig,
): void {
	if (tool !== "apply_patch" || typeof toolParams?.patch !== "string") return
	for (const patchFilePath of extractFilePathsFromPatch(toolParams.patch)) {
		if (!doesFileMatchRegex(patchFilePath!, options.fileRegex!)) {
			throw new FileRestrictionError(mode.name, options.fileRegex!, options.description, patchFilePath!, tool)
		}
	}
}

export function validateEditGroupRestrictions(
	tool: string,
	toolParams: Record<string, unknown> | undefined,
	options: GroupOptions,
	mode: ModeConfig,
): void {
	if (!options.fileRegex) return
	if (isEditFilePathValid(tool, toolParams, options, mode)) return
	validateApplyPatchPaths(tool, toolParams, options, mode)
}

export function matchesGroup(
	tool: string,
	resolvedTool: string,
	group: GroupEntry,
	isDynamicMcpTool: boolean,
	toolParams: Record<string, unknown> | undefined,
	resolvedIncludedTools: string[] | undefined,
	mode: ModeConfig,
): boolean {
	const groupName = getGroupName(group)
	const options = getGroupOptions(group)
	const groupConfig = TOOL_GROUPS[groupName]

	if (isDynamicMcpTool && groupName === "mcp") return true

	const isRegularTool = groupConfig.tools.includes(resolvedTool)
	const isCustomTool =
		groupConfig.customTools?.includes(resolvedTool) && resolvedIncludedTools?.includes(resolvedTool)

	if (!isRegularTool && !isCustomTool) return false
	if (!options) return true
	if (groupName === "edit") validateEditGroupRestrictions(tool, toolParams, options, mode)

	return true
}

export function isToolInModeGroups(
	tool: string,
	resolvedTool: string,
	mode: ModeConfig,
	isDynamicMcpTool: boolean,
	toolParams: Record<string, unknown> | undefined,
	resolvedIncludedTools: string[] | undefined,
): boolean {
	for (const group of mode.groups) {
		if (matchesGroup(tool, resolvedTool, group, isDynamicMcpTool, toolParams, resolvedIncludedTools, mode)) {
			return true
		}
	}
	return false
}

export function isToolAllowedForMode(
	tool: string,
	modeSlug: string,
	customModes: ModeConfig[],
	toolRequirements?: Record<string, boolean> | false,
	toolParams?: { [key: string]: unknown },
	experiments?: Record<string, boolean>,
	includedTools?: string[],
): boolean {
	const resolvedTool = TOOL_ALIASES[tool] ?? tool
	const resolvedIncludedTools = includedTools?.map((t) => TOOL_ALIASES[t] ?? t)

	if (isToolDisabledByRequirements(tool, resolvedTool, toolRequirements)) return false
	if (isAlwaysAllowedTool(tool, resolvedTool, experiments)) return true
	if (isExperimentDisabled(tool, experiments)) return false

	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) return false

	return isToolInModeGroups(tool, resolvedTool, mode, tool.startsWith("mcp_"), toolParams, resolvedIncludedTools)
}
