import type { EventBridge } from "../../../core/webview/EventBridge"
import type { WebviewMessage } from "@jabberwock/types"
import type { Command } from "../../../services/command/commands"
import type { TodoItem } from "@jabberwock/types"
import { setPendingTodoList } from "../../../core/tools/UpdateTodoListTool"
import { TelemetryService } from "@jabberwock/telemetry"

export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

import { handleModeSwitch, getWindowManagerState } from "../../foundation/window-manager/store"
import { getSkillsManager } from "../../settings/skills/store"
import { getMstState } from "../../foundation/mst/store"
export const handlerMap: Record<string, HandlerFn> = {
	mode: async (provider, message) => {
		await handleModeSwitch(provider, message.text as string)
	},

	requestCommands: async (provider, message) => {
		try {
			const { getCommands } = await import("../../../services/command/commands")
			const currentCline = provider.getCurrentTask()
			const cwd = currentCline?.cwd || provider.cwd
			const commands: Command[] = await getCommands(cwd)

			const commandList = commands.map((command) => ({
				name: command.name,
				source: command.source,
				filePath: command.filePath,
				description: command.description,
				argumentHint: command.argumentHint,
			}))

			const existingCommandNames = new Set(commandList.map((command) => command.name))
			const skillsManager = getSkillsManager(provider)

			if (skillsManager) {
				const getCurrentMode = async (): Promise<string> => {
					const currentTask = provider.getCurrentTask()
					if (currentTask) {
						try {
							return await currentTask.getTaskMode()
						} catch (error) {
							provider.log(
								`Error resolving current task mode for command discovery: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
							)
						}
					}
					try {
						const state = await provider.getState()
						if (typeof state.mode === "string" && state.mode.length > 0) {
							return state.mode
						}
					} catch (error) {
						provider.log(
							`Error resolving global mode for command discovery: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
						)
					}
					const { defaultModeSlug } = await import("../../../shared/modes")
					return defaultModeSlug
				}

				const currentMode = await getCurrentMode()
				const availableSkills = skillsManager.getSkillsForMode(currentMode)

				for (const skill of availableSkills) {
					if (existingCommandNames.has(skill.name)) {
						continue
					}
					existingCommandNames.add(skill.name)
					commandList.push({
						name: skill.name,
						source: skill.source,
						filePath: skill.path,
						description: skill.description,
						argumentHint: undefined,
					})
				}
			}

			await provider.postMessageToWebview({ type: "commands", commands: commandList })
			getMstState(provider).commandsStore?.setCommands(commandList)
		} catch (error) {
			provider.log(`Error fetching commands: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
			await provider.postMessageToWebview({ type: "commands", commands: [] })
			getMstState(provider).commandsStore?.setCommands([])
		}
	},

	switchMode: async (provider, message) => {
		// Same as mode handler, switchMode is an alias
		await handleModeSwitch(provider, message.text as string)
	},

	updateTodoList: async (provider, message) => {
		const payload = message.payload as { todos?: unknown[] }
		const todos = payload?.todos
		if (Array.isArray(todos)) {
			await setPendingTodoList(todos as TodoItem[])
		}
	},
}
