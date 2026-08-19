import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import * as vscode from "vscode"
import * as fs from "fs/promises"
import type { IBackendRootStore } from "@features/store"
import { getVscodeContext } from "@features/foundation/vscode/context"
import { EventBridge } from "@features/foundation/webview/EventBridge"
import { t } from "@i18n"
import { Package } from "@shared/package"
import { getCommand } from "@services/command/commands"
import { openFile } from "@integrations/misc/open-file"
import { createCommandFile } from "./commands-utils"

export function registerSettingsCommands(bus: IntentBus): void {
	bus.register(IntentType.SettingsCommandsAllowedSet, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}
		const payload = intent.payload as { commands: string[] }
		const commands = payload.commands ?? []
		const validCommands = Array.isArray(commands)
			? commands.filter((cmd) => typeof cmd === "string" && cmd.trim().length > 0)
			: []

		await getVscodeContext().updateGlobalState("allowedCommands", validCommands)
		await vscode.workspace
			.getConfiguration(Package.name)
			.update("allowedCommands", validCommands, vscode.ConfigurationTarget.Global)
	})

	bus.register(IntentType.SettingsCommandsDeniedSet, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}
		const payload = intent.payload as { commands: string[] }
		const commands = payload.commands ?? []
		const validCommands = Array.isArray(commands)
			? commands.filter((cmd) => typeof cmd === "string" && cmd.trim().length > 0)
			: []

		await getVscodeContext().updateGlobalState("deniedCommands", validCommands)
		await vscode.workspace
			.getConfiguration(Package.name)
			.update("deniedCommands", validCommands, vscode.ConfigurationTarget.Global)
	})

	bus.register(IntentType.SettingsCommandsFileOpen, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}
		const payload = intent.payload as { text: string }

		try {
			if (!payload.text) {
				return
			}

			const cwd = (ctx.rootStore as IBackendRootStore).chat.activeTask?.cwd ?? ""
			const command = await getCommand(cwd, payload.text)

			if (command?.filePath) {
				openFile(command.filePath)
			} else {
				vscode.window.showErrorMessage(t("common:errors.command_not_found", { name: payload.text }))
			}
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error opening command file: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			vscode.window.showErrorMessage(t("common:errors.open_command_file"))
		}
	})

	bus.register(IntentType.SettingsCommandsDelete, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}
		const payload = intent.payload as { text: string; values?: { source: string } }
		if (!payload.text) {
			return
		}

		try {
			const cwd = (ctx.rootStore as IBackendRootStore).chat.activeTask?.cwd ?? ""
			const command = await getCommand(cwd, payload.text)
			if (!command?.filePath) {
				vscode.window.showErrorMessage(t("common:errors.command_not_found", { name: payload.text }))
				return
			}
			await fs.unlink(command.filePath)
			EventBridge.outputChannel?.appendLine(`Deleted command file: ${command.filePath}`)
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error deleting command: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			vscode.window.showErrorMessage(t("common:errors.delete_command"))
		}
	})

	bus.register(IntentType.SettingsCommandsCreate, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}
		const payload = intent.payload as { text: string; values: { source: string } }

		try {
			await createCommandFile(provider, ctx.rootStore as IBackendRootStore, payload, ctx)
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error creating command: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			vscode.window.showErrorMessage(t("common:errors.create_command_failed"))
		}
	})
}
