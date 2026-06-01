import * as vscode from "vscode"
import { WebviewMessage } from "../../../shared/WebviewMessage"
import { defaultModeSlug } from "../../../shared/modes"
import type { ProviderSettings } from "@jabberwock/types"
import { buildApiHandler } from "../../../api"

import { SYSTEM_PROMPT } from "./system"
import { MultiSearchReplaceDiffStrategy } from "@features/foundation/time-machine/actions/strategies/multi-search-replace"
import { Package } from "../../../shared/package"

import { EventBridge } from "@features/foundation/webview/EventBridge"
import { getSkillsManager } from "../skills/store"
import { getBackendRootStore } from "@features/storeSingleton"
import { getVscodeContext } from "@features/foundation/vscode/context"
import { getWorkspacePath } from "../../../utils/path"
import { getSettingsAccess } from "@utils/settings-access"

import { getMcpServerManager } from "../../../services/mcp/McpServerManager"
import { getIgnoreInstructions } from "@features/settings/constants"

export const generateSystemPrompt = async (provider: EventBridge, message: WebviewMessage) => {
	const state = getBackendRootStore()
	const contextValues = getSettingsAccess().getValues()

	const {
		apiConfiguration,
		customModePrompts,
		customInstructions,
		mcpEnabled,
		experiments,
		language,
		enableSubfolderRules,
	} = {
		apiConfiguration: state.settings.apiConfig.toProviderSettings(),
		customModePrompts: contextValues.customModePrompts,
		customInstructions: contextValues.customInstructions,
		mcpEnabled: contextValues.mcpEnabled,
		experiments: contextValues.experiments,
		language: contextValues.language,
		enableSubfolderRules: contextValues.enableSubfolderRules,
	}

	const diffStrategy = new MultiSearchReplaceDiffStrategy()

	const cwd = getWorkspacePath()

	const mode = message.mode ?? defaultModeSlug
	const customModes = getBackendRootStore().settings.modes.customModes ?? []

	const jabberwockIgnoreInstructions = getIgnoreInstructions(state.chat.activeTask?.jabberwockIgnoreController)

	// Create a temporary API handler to check model info for stealth mode.
	// This avoids relying on an active Cline instance which might not exist during preview.
	let modelInfo: { isStealthModel?: boolean } | undefined
	try {
		const tempApiHandler = buildApiHandler(apiConfiguration as ProviderSettings)
		modelInfo = tempApiHandler.getModel().info
	} catch (error) {
		console.error("[jabberwock] Error fetching model info for system prompt preview:", error)
	}

	const systemPrompt = await SYSTEM_PROMPT(
		getVscodeContext().extensionContext,
		cwd,
		false, // supportsComputerUse — browser removed
		mcpEnabled ? (getMcpServerManager().getMcpHub() ?? undefined) : undefined,
		diffStrategy,
		mode,
		customModePrompts,
		customModes,
		customInstructions,
		experiments,
		language,
		jabberwockIgnoreInstructions,
		{
			todoListEnabled: (apiConfiguration?.todoListEnabled as boolean) ?? true,
			useAgentRules: vscode.workspace.getConfiguration(Package.name).get<boolean>("useAgentRules") ?? true,
			enableSubfolderRules: enableSubfolderRules ?? false,
			newTaskRequireTodos: vscode.workspace
				.getConfiguration(Package.name)
				.get<boolean>("newTaskRequireTodos", false),
			isStealthModel: modelInfo?.isStealthModel,
		},
		undefined, // todoList
		undefined, // modelId
		getSkillsManager(state),
		contextValues.systemPromptTemplates,
	)

	return systemPrompt
}
