import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import * as fs from "fs/promises"
import type { IBackendRootStore } from "@features/store"
import { getHostEnvironment } from "@features/foundation/host-context/context"
import { getConfiguration } from "@features/foundation/capabilities/registry"
import { log as backendLog } from "@features/foundation/capabilities/backend-logger"
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

		await getHostEnvironment().updateGlobalState("allowedCommands", validCommands)
		// D4g-2 (batch 3): config write via the capability slot (D4b).
		await getConfiguration().update(Package.name, "allowedCommands", validCommands)
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

		await getHostEnvironment().updateGlobalState("deniedCommands", validCommands)
		// D4g-2 (batch 3): config write via the capability slot (D4b).
		await getConfiguration().update(Package.name, "deniedCommands", validCommands)
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
				publishNotificationError(t("common:errors.command_not_found", { name: payload.text }))
			}
		} catch (error) {
			backendLog.info(
				`Error opening command file: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			publishNotificationError(t("common:errors.open_command_file"))
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
				publishNotificationError(t("common:errors.command_not_found", { name: payload.text }))
				return
			}
			await fs.unlink(command.filePath)
			backendLog.info(`Deleted command file: ${command.filePath}`)
		} catch (error) {
			backendLog.info(
				`Error deleting command: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			publishNotificationError(t("common:errors.delete_command"))
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
			backendLog.info(
				`Error creating command: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			publishNotificationError(t("common:errors.create_command_failed"))
		}
	})
}

import { publishNotificationError } from "@features/foundation/capabilities/notifications"
