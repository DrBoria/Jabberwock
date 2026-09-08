import pWaitFor from "p-wait-for"
import { getConfiguration } from "@features/foundation/capabilities/registry"
import { McpHub } from "@services/mcp/core/McpHub"
import { getMcpServerManager } from "@services/mcp/core/McpServerManager"
import { SYSTEM_PROMPT } from "./system"
import { defaultModeSlug } from "@shared/modes"
import { type ModeConfig } from "@jabberwock/types"
import { Package } from "@shared/package"
import type { ITaskModel } from "@features/chat/task/store"
import { setupMcpHubListeners } from "@features/settings/mcp/mcpIntegration"
import { getSkillsManager } from "@features/settings/skills/store"
import { getBackendRootStore } from "@features/storeSingleton"
import { getSettingsAccess } from "@utils/settings"

import { getIgnoreInstructions } from "@features/settings/constants"
import { getProvider } from "@features/foundation/webview/providerRegistry"
import { getHostEnvironment } from "@features/foundation/host-context/context"

/**
 * Get the system prompt for this task, including MCP server configuration,
 * custom modes, and other dynamic settings.
 *
 * @param task - The Task instance
 * @returns The system prompt string
 */
/** Typed helper to access `diffStrategy` on an ITaskModel without as-unknown. */
function getTaskDiffStrategy(task: ITaskModel): import("@shared/tools").DiffStrategy | undefined {
	return (task as ITaskModel & { diffStrategy?: import("@shared/tools").DiffStrategy }).diffStrategy
}

export async function getSystemPrompt(task: ITaskModel): Promise<string> {
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
		systemPromptTemplates,
	} = {
		apiConfiguration: state.settings.apiConfig.toProviderSettings(),
		customModePrompts: contextValues.customModePrompts,
		customInstructions: contextValues.customInstructions,
		mcpEnabled: contextValues.mcpEnabled,
		experiments: contextValues.experiments,
		language: contextValues.language,
		enableSubfolderRules: contextValues.enableSubfolderRules,
		systemPromptTemplates: contextValues.systemPromptTemplates,
	}

	const customModes = getBackendRootStore().settings.modes.customModes.filter(Boolean) as ModeConfig[]

	let mcpHub: McpHub | undefined
	if (mcpEnabled ?? true) {
		const provider = getProvider()

		// Wait for MCP hub initialization through McpServerManager
		mcpHub = await getMcpServerManager().getInstance(getHostEnvironment().extensionContext, provider) // v4 B2 fix: pass the DI-backed structural view - ProviderHandle stub context has no globalState member (crash at McpServerManager init: reading 'update' on undefined)

		if (!mcpHub) {
			throw new Error("Failed to get MCP hub from server manager")
		}

		// Set up listeners for elicitation UI
		setupMcpHubListeners(task, mcpHub)

		// Wait for MCP servers to be connected before generating system prompt
		await pWaitFor(() => !mcpHub!.isConnecting, { timeout: 10_000 }).catch(() => {
			console.error("[jabberwock] MCP servers failed to connect in time")
		})
	}

	const jabberwockIgnoreInstructions = getIgnoreInstructions(task.jabberwockIgnoreController)

	return await (async () => {
		const modelInfo = task.api!.getModel().info

		return SYSTEM_PROMPT(
			getHostEnvironment().extensionContext, // v4 B2 fix: full DI-backed context view; ProviderHandle stub has no globalState
			task.cwd,
			false,
			mcpHub,
			getTaskDiffStrategy(task),
			task._state._taskMode || defaultModeSlug,
			customModePrompts,
			customModes as ModeConfig[],
			customInstructions,
			experiments,
			language,
			jabberwockIgnoreInstructions,
			{
				todoListEnabled: (apiConfiguration?.todoListEnabled as boolean) ?? true,
				useAgentRules: getConfiguration().get<boolean>(Package.name, "useAgentRules") ?? true,
				enableSubfolderRules: enableSubfolderRules ?? false,
				newTaskRequireTodos:
					getConfiguration().get<boolean>(Package.name, "newTaskRequireTodos", false) ?? false,
				isStealthModel: modelInfo?.isStealthModel,
			},
			undefined, // todoList
			task.api!.getModel().id,
			getSkillsManager(getBackendRootStore()),
			systemPromptTemplates,
		)
	})()
}
