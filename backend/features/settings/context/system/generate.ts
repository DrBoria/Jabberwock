import { defaultModeSlug } from "@shared/modes"
import type { ProviderSettings, WebviewMessage } from "@jabberwock/types"
import { buildApiHandler } from "@api"

import { SYSTEM_PROMPT } from "./main"
import { MultiSearchReplaceDiffStrategy } from "@features/foundation"
import { Package } from "@shared/core/package"

import { EventBridge } from "@features/foundation"
import { getSkillsManager } from "@features/settings/skills"
import { getStore } from "@features/singleton"
import { getHostEnvironment } from "@features/foundation"
import { getWorkspacePath } from "@utils/io/main"
import { getSettingsAccess } from "@utils/settings"
import { getConfiguration } from "@features/foundation"

import { getMcpServerManager } from "@services/mcp/core/McpServerManager"
import { getIgnoreInstructions } from "@features/settings"

import type { SystemPromptSettings } from "@features/settings/context/types"
export const generateSystemPrompt = async (provider: EventBridge, message: WebviewMessage) => {
	const state = getStore()
	const contextValues = getSettingsAccess().getValues()

	const apiConfiguration = state.settings.apiConfig.toProviderSettings()
	const { customModePrompts, customInstructions, mcpEnabled, experiments, language, enableSubfolderRules } =
		contextValues

	const diffStrategy = MultiSearchReplaceDiffStrategy()
	const cwd = getWorkspacePath()
	const mode = message.mode ?? defaultModeSlug
	const customModes = getStore().settings.modes.customModes ?? []

	const jabberwockIgnoreInstructions = getIgnoreInstructions(state.chat.activeTask?.jabberwockIgnoreController)

	const modelInfo = fetchModelInfo(apiConfiguration)
	const systemPromptSettings = buildSystemPromptSettings(apiConfiguration, enableSubfolderRules, modelInfo)

	const systemPrompt = await SYSTEM_PROMPT(
		getHostEnvironment().extensionContext,
		cwd,
		false,
		mcpEnabled ? (getMcpServerManager().getMcpHub() ?? undefined) : undefined,
		diffStrategy,
		mode,
		customModePrompts,
		customModes,
		customInstructions,
		experiments,
		language,
		jabberwockIgnoreInstructions,
		systemPromptSettings,
		undefined,
		undefined,
		getSkillsManager(state),
		contextValues.systemPromptTemplates,
	)

	return systemPrompt
}

function fetchModelInfo(apiConfiguration: { [key: string]: unknown }): { isStealthModel?: boolean } | undefined {
	try {
		const tempApiHandler = buildApiHandler(apiConfiguration as ProviderSettings)
		return tempApiHandler.getModel().info
	} catch {
		console.error("[jabberwock] Error fetching model info for system prompt preview:")
		return undefined
	}
}

function buildSystemPromptSettings(
	apiConfiguration: { [key: string]: unknown },
	enableSubfolderRules: boolean | undefined,
	modelInfo: { isStealthModel?: boolean } | undefined,
): SystemPromptSettings {
	return {
		todoListEnabled: (apiConfiguration?.todoListEnabled as boolean) ?? true,
		// D4g-2 (batch 3): config reads via the capability slot (D4b).
		useAgentRules: getConfiguration().get<boolean>(Package.name, "useAgentRules") ?? true,
		enableSubfolderRules: enableSubfolderRules ?? false,
		newTaskRequireTodos: getConfiguration().get<boolean>(Package.name, "newTaskRequireTodos", false) ?? false,
		isStealthModel: modelInfo?.isStealthModel,
	}
}
