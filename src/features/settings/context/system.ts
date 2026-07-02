import * as vscode from "vscode"

import { type ModeConfig, type PromptComponent, type CustomModePrompts, type TodoItem } from "@jabberwock/types"

import { Mode, modes, defaultModeSlug, getModeBySlug, getGroupName, getModeSelection } from "@shared/modes"
import { DiffStrategy } from "@shared/tools"
import { formatLanguage } from "@shared/language"
import { isEmpty } from "@utils/object"

import { McpHub } from "@services/mcp/core/McpHub"
import { CodeIndexManager } from "@services/code-index/manager/manager"
import { getCodeIndexManager } from "@services/code-index/manager/manager.factory"
import { SkillsManager } from "@services/skills/SkillsManager"

import type { SystemPromptSettings } from "./types"
import {
	getRulesSection,
	getSystemInfoSection,
	getObjectiveSection,
	getSharedToolUseSection,
	getToolUseGuidelinesSection,
	getCapabilitiesSection,
	getModesSection,
	addCustomInstructions,
	markdownFormattingSection,
	getSkillsSection,
} from "./sections"

// Helper function to get prompt component, filtering out empty objects
export function getPromptComponent(
	customModePrompts: CustomModePrompts | undefined,
	mode: string,
): PromptComponent | undefined {
	const component = customModePrompts?.[mode]
	// Return undefined if component is empty
	if (isEmpty(component)) {
		return undefined
	}
	return component
}

import { agentStore } from "@features/settings/agents/store/index"

async function generatePrompt(
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mode: Mode,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	promptComponent?: PromptComponent,
	customModeConfigs?: ModeConfig[],
	globalCustomInstructions?: string,
	experiments?: Record<string, boolean>,
	language?: string,
	jabberwockIgnoreInstructions?: string,
	settings?: SystemPromptSettings,
	todoList?: TodoItem[],
	modelId?: string,
	skillsManager?: SkillsManager,
	systemPromptTemplates?: Record<string, string>,
): Promise<string> {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	const modeSelection = getModeSelection(mode, promptComponent, customModeConfigs)
	let roleDefinition = modeSelection.roleDefinition
	let baseInstructions = modeSelection.baseInstructions

	const agentProfile = agentStore.agents.get(mode)
	if (agentProfile && !roleDefinition) {
		roleDefinition = agentProfile.systemPrompt
		baseInstructions = ""
	}

	const modeConfig = resolveModeConfig(mode, customModeConfigs)
	const shouldIncludeMcp = shouldIncludeMcpSection(modeConfig, mcpHub)

	const codeIndexManager = getCodeIndexManager(context, cwd)

	const [modesSection, skillsSection] = await Promise.all([
		getModesSection(context),
		getSkillsSection(skillsManager, mode as string),
	])

	const tpl = systemPromptTemplates || {}

	const basePrompt = buildBasePrompt(
		roleDefinition,
		tpl,
		cwd,
		shouldIncludeMcp ? mcpHub : undefined,
		mode,
		customModeConfigs,
		modesSection,
		skillsSection,
		settings,
		baseInstructions,
		globalCustomInstructions ?? "",
		language ? language : formatLanguage(vscode.env.language),
		jabberwockIgnoreInstructions,
	)

	return basePrompt
}

function resolveModeConfig(mode: Mode, customModeConfigs?: ModeConfig[]): ModeConfig {
	return getModeBySlug(mode, customModeConfigs) || modes.find((m) => m.slug === mode) || modes[0]
}

function shouldIncludeMcpSection(modeConfig: ModeConfig, mcpHub?: McpHub): boolean {
	const hasMcpGroup = modeConfig.groups.some((groupEntry) => getGroupName(groupEntry) === "mcp")
	const hasMcpServers = !!(mcpHub && mcpHub.getServers().length > 0)
	return hasMcpGroup && hasMcpServers
}

function formatTemplate(template: string, defaultContent: string): string {
	if (!template) {
		return defaultContent
	}
	return template
}

async function buildBasePrompt(
	roleDefinition: string,
	tpl: Record<string, string>,
	cwd: string,
	mcpHub: McpHub | undefined,
	mode: Mode,
	customModeConfigs: ModeConfig[] | undefined,
	modesSection: string,
	skillsSection: string,
	settings: SystemPromptSettings | undefined,
	baseInstructions: string,
	globalCustomInstructions: string,
	language: string,
	jabberwockIgnoreInstructions: string | undefined,
): Promise<string> {
	const toolsCatalog = ""

	return `${roleDefinition}

${formatTemplate(tpl.markdownRules ?? "", markdownFormattingSection())}

${formatTemplate(
	tpl.toolUse ?? "",
	`${getSharedToolUseSection()}${toolsCatalog}

	${getToolUseGuidelinesSection()}`,
)}

${formatTemplate(tpl.capabilities ?? "", getCapabilitiesSection(cwd, mcpHub, mode, customModeConfigs))}

${formatTemplate(tpl.modes ?? "", modesSection)}
${skillsSection ? `\n${skillsSection}` : ""}
${formatTemplate(tpl.rules ?? "", getRulesSection(cwd, settings))}

${formatTemplate(tpl.systemInfo ?? "", getSystemInfoSection(cwd))}

${formatTemplate(tpl.objective ?? "", getObjectiveSection())}

${await addCustomInstructions(baseInstructions, globalCustomInstructions, cwd, mode, {
	language,
	jabberwockIgnoreInstructions,
	settings,
})}`
}

export const SYSTEM_PROMPT = async (
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	mode: Mode = defaultModeSlug,
	customModePrompts?: CustomModePrompts,
	customModes?: ModeConfig[],
	globalCustomInstructions?: string,
	experiments?: Record<string, boolean>,
	language?: string,
	jabberwockIgnoreInstructions?: string,
	settings?: SystemPromptSettings,
	todoList?: TodoItem[],
	modelId?: string,
	skillsManager?: SkillsManager,
	systemPromptTemplates?: Record<string, string>,
): Promise<string> => {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	// Check if it's a custom mode
	const promptComponent = getPromptComponent(customModePrompts, mode)

	// Get full mode config from custom modes or fall back to built-in modes
	const currentMode = getModeBySlug(mode, customModes) || modes.find((m) => m.slug === mode) || modes[0]

	return generatePrompt(
		context,
		cwd,
		supportsComputerUse,
		currentMode.slug,
		mcpHub,
		diffStrategy,
		promptComponent,
		customModes,
		globalCustomInstructions,
		experiments,
		language,
		jabberwockIgnoreInstructions,
		settings,
		todoList,
		modelId,
		skillsManager,
		systemPromptTemplates,
	)
}
