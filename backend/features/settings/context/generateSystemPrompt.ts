import { defaultModeSlug } from "@shared/modes"
import type { ProviderSettings, WebviewMessage } from "@jabberwock/types"
import { buildApiHandler } from "@api"

import { SYSTEM_PROMPT } from "./system"
import { MultiSearchReplaceDiffStrategy } from "@features/foundation/time-machine/actions/strategies/multi-search-replace"
import { Package } from "@shared/package"

import { EventBridge } from "@features/foundation/webview/EventBridge"
import { getSkillsManager } from "@features/settings/skills/store"
import { getBackendRootStore } from "@features/storeSingleton"
import { getHostEnvironment } from "@features/foundation/host-context/context"
import { getWorkspacePath } from "@utils/io/path"
import { getSettingsAccess } from "@utils/settings"
import { getConfiguration } from "@features/foundation/capabilities/registry"

import { getMcpServerManager } from "@services/mcp/core/McpServerManager"
import { getIgnoreInstructions } from "@features/settings/constants"

import type { SystemPromptSettings } from "./types"
export const generateSystemPrompt = async (provider: EventBridge, message: WebviewMessage) => {
	const state = getBackendRootStore()
	const contextValues = getSettingsAccess().getValues()

	const apiConfiguration = state.settings.apiConfig.toProviderSettings()
	const { customModePrompts, customInstructions, mcpEnabled, experiments, language, enableSubfolderRules } =
		contextValues

	const diffStrategy = new MultiSearchReplaceDiffStrategy()
	const cwd = getWorkspacePath()
	const mode = message.mode ?? defaultModeSlug
	const customModes = getBackendRootStore().settings.modes.customModes ?? []

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
