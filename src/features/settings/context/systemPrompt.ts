import * as vscode from "vscode"
import pWaitFor from "p-wait-for"
import { McpHub } from "../../../services/mcp/McpHub"
import { getMcpServerManager } from "../../../services/mcp/McpServerManager"
import { SYSTEM_PROMPT } from "./system"
import { defaultModeSlug } from "../../../shared/modes"
import { type ModeConfig } from "@jabberwock/types"
import { Package } from "../../../shared/package"
import type { ITaskModel } from "../../chat/task/store"
import { setupMcpHubListeners } from "../mcp/mcpIntegration"
import { getSkillsManager } from "../skills/store"
import { getBackendRootStore } from "@features/storeSingleton"
import { getSettingsAccess } from "@utils/settings-access"

import { getIgnoreInstructions } from "@features/settings/constants"

/**
 * Get the system prompt for this task, including MCP server configuration,
 * custom modes, and other dynamic settings.
 *
 * @param task - The Task instance
 * @returns The system prompt string
 */
/** Typed helper to access `diffStrategy` on an ITaskModel without as-unknown. */
function getTaskDiffStrategy(task: ITaskModel): import("../../../shared/tools").DiffStrategy | undefined {
	return (task as ITaskModel & { diffStrategy?: import("../../../shared/tools").DiffStrategy }).diffStrategy
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
		const provider = task.providerRef!.deref()

		if (!provider) {
			throw new Error("Provider reference lost during view transition")
		}

		// Wait for MCP hub initialization through McpServerManager
		mcpHub = await getMcpServerManager().getInstance(provider.context, provider)

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

	// DEBUG: Log what mode and custom modes are resolved for system prompt building
	const resolvedModeConfig = customModes?.find((m) => m.slug === (task._state._taskMode || defaultModeSlug))

	return await (async () => {
		const provider = task.providerRef!.deref()

		if (!provider) {
			throw new Error("Provider not available")
		}

		const modelInfo = task.api!.getModel().info

		return SYSTEM_PROMPT(
			provider.context,
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
				useAgentRules: vscode.workspace.getConfiguration(Package.name).get<boolean>("useAgentRules") ?? true,
				enableSubfolderRules: enableSubfolderRules ?? false,
				newTaskRequireTodos: vscode.workspace
					.getConfiguration(Package.name)
					.get<boolean>("newTaskRequireTodos", false),
				isStealthModel: modelInfo?.isStealthModel,
			},
			undefined, // todoList
			task.api!.getModel().id,
			getSkillsManager(getBackendRootStore()),
			systemPromptTemplates,
		)
	})()
}
