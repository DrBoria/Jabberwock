import * as vscode from "vscode"
import pWaitFor from "p-wait-for"
import { McpHub } from "../../../../services/mcp/McpHub"
import { McpServerManager, getMcpServerManager } from "../../../../services/mcp/McpServerManager"
import { SYSTEM_PROMPT } from "../../../../core/prompts/system"
import { defaultModeSlug } from "../../../../shared/modes"
import { type ModeConfig } from "@jabberwock/types"
import { Package } from "../../../../shared/package"
import { Task } from "../Task"
import { getSkillsManager } from "../../../settings/skills/store"

/**
 * Get the system prompt for this task, including MCP server configuration,
 * custom modes, and other dynamic settings.
 *
 * @param task - The Task instance
 * @returns The system prompt string
 */
export async function getSystemPrompt(task: Task): Promise<string> {
	const { mcpEnabled } = (await task.providerRef.deref()?.getState()) ?? {}
	let mcpHub: McpHub | undefined
	if (mcpEnabled ?? true) {
		const provider = task.providerRef.deref()

		if (!provider) {
			throw new Error("Provider reference lost during view transition")
		}

		// Wait for MCP hub initialization through McpServerManager
		mcpHub = await getMcpServerManager().getInstance(provider.context, provider)

		if (!mcpHub) {
			throw new Error("Failed to get MCP hub from server manager")
		}

		// Set up listeners for elicitation UI
		task.setupMcpHubListeners(mcpHub)

		// Wait for MCP servers to be connected before generating system prompt
		await pWaitFor(() => !mcpHub!.isConnecting, { timeout: 10_000 }).catch(() => {
			console.error("MCP servers failed to connect in time")
		})
	}

	const jabberwockIgnoreInstructions = task.jabberwockIgnoreController?.getInstructions()

	const state = await task.providerRef.deref()?.getState()

	const {
		customModes,
		customModePrompts,
		customInstructions,
		systemPromptTemplates,
		experiments,
		language,
		apiConfiguration,
		enableSubfolderRules,
	} = state ?? {}

	// DEBUG: Log what mode and custom modes are resolved for system prompt building
	const resolvedModeConfig = (customModes as Array<{ slug: string }>)?.find(
		(m) => m.slug === (task.taskMode || defaultModeSlug),
	)

	return await (async () => {
		const provider = task.providerRef.deref()

		if (!provider) {
			throw new Error("Provider not available")
		}

		const modelInfo = task.api.getModel().info

		return SYSTEM_PROMPT(
			provider.context,
			task.cwd,
			false,
			mcpHub,
			task.diffStrategy,
			task.taskMode || defaultModeSlug,
			customModePrompts,
			customModes as ModeConfig[],
			customInstructions,
			experiments,
			language,
			jabberwockIgnoreInstructions,
			{
				todoListEnabled: apiConfiguration?.todoListEnabled ?? true,
				useAgentRules: vscode.workspace.getConfiguration(Package.name).get<boolean>("useAgentRules") ?? true,
				enableSubfolderRules: enableSubfolderRules ?? false,
				newTaskRequireTodos: vscode.workspace
					.getConfiguration(Package.name)
					.get<boolean>("newTaskRequireTodos", false),
				isStealthModel: modelInfo?.isStealthModel,
			},
			undefined, // todoList
			task.api.getModel().id,
			getSkillsManager(provider),
			systemPromptTemplates,
		)
	})()
}
