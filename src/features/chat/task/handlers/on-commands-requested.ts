import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../intents/bus"
import type { Command } from "../../../../services/command/commands"
import { getCommands } from "../../../../services/command/commands"
import { EventBridge } from "@features/foundation/webview/EventBridge"
import { getSkillsManager } from "../../../settings/skills/store"
import { getMstState } from "../../../foundation/mst/store"
import { defaultModeSlug } from "../../../../shared/modes"

/**
 * Handles topic.commands.requested intent — fetches commands and skills, sends to webview.
 * Migrated from chat/topic/handlers/on-commands-requested.ts
 */
export function registerOnTopicCommandsRequested(bus: IntentBus): void {
	bus.register(IntentType.TopicCommandsRequested, async (_intent, ctx) => {
		const provider = ctx.provider

		if (!provider) {
			return
		}

		try {
			const currentCline = ctx.rootStore.chat.activeTask
			const cwd = currentCline?.cwd
			const commands: Command[] = await getCommands(cwd ?? "")

			const commandList = commands.map((command) => ({
				name: command.name,
				source: command.source,
				filePath: command.filePath,
				description: command.description,
				argumentHint: command.argumentHint,
			}))

			const existingCommandNames = new Set(commandList.map((command) => command.name))
			const skillsManager = getSkillsManager(ctx.rootStore)

			if (skillsManager) {
				const getCurrentMode = async (): Promise<string> => {
					const currentTask = ctx.rootStore.chat.activeTask
					if (currentTask) {
						return (await currentTask.getTaskMode()) ?? defaultModeSlug
					}
					return defaultModeSlug
				}
				const currentMode = await getCurrentMode()
				const skillsForMode = skillsManager.getSkillsForMode(currentMode)

				for (const skill of skillsForMode) {
					if (!existingCommandNames.has(skill.name)) {
						commandList.push({
							name: skill.name,
							source: skill.source as "global" | "project" | "built-in",
							filePath: skill.path,
							description: skill.description,
							argumentHint: undefined,
						})
					}
				}
			}

			await provider.postMessageToWebview({
				type: "commands",
				commands: commandList,
			})
		} catch (error) {
			console.error("[jabberwock] Error fetching commands:", error)
		}
	})
}
