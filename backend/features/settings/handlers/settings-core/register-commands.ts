import { getWorkspaceRoots } from "@features/foundation"
import type { IntentBus, IntentHandlerContext } from "@features/intents"
import * as os from "os"
import * as path from "path"
import { getCommands } from "@services/command/commands"
import { sendCommands } from "@features/chat"

import { IntentType } from "@jabberwock/types"
import * as fs from "fs/promises"
import type { IBackendRootStore } from "@features/store"
import { getHostEnvironment } from "@features/foundation"
import { getConfiguration } from "@features/foundation"
import { log as backendLog } from "@features/foundation"
import { t } from "@i18n"
import { Package } from "@shared/core/package"
import { getCommand } from "@services/command/commands"
import { openFile } from "@integrations/misc/open-file"
import { publishNotificationError } from "@features/foundation"

function registerCommandsSettingsCommandsAllowedSet(bus: IntentBus): void {
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
}

function registerCommandsSettingsCommandsDeniedSet(bus: IntentBus): void {
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
}

function registerCommandsSettingsCommandsFileOpen(bus: IntentBus): void {
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
}

function registerCommandsSettingsCommandsDelete(bus: IntentBus): void {
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
}

function registerCommandsSettingsCommandsCreate(bus: IntentBus): void {
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

export function registerCommands(_bus: IntentBus): void {
	registerCommandsSettingsCommandsAllowedSet(_bus)
	registerCommandsSettingsCommandsDeniedSet(_bus)
	registerCommandsSettingsCommandsFileOpen(_bus)
	registerCommandsSettingsCommandsDelete(_bus)
	registerCommandsSettingsCommandsCreate(_bus)
}

// v4 B2 (L4): workspace roots come from "the" host context DI slot, not vscode directly.

export function sanitizeCommandName(fileName: string): string {
	if (!fileName || !fileName.trim()) {
		return ""
	}

	let cleanFileName = fileName.trim()
	if (cleanFileName.startsWith("/")) {
		cleanFileName = cleanFileName.substring(1)
	}
	if (cleanFileName.toLowerCase().endsWith(".md")) {
		cleanFileName = cleanFileName.slice(0, -3)
	}

	const slug = cleanFileName
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")

	if (!slug) {
		return ""
	}

	return slug
}

export async function resolveCommandsDir(source: string, ctx: IntentHandlerContext): Promise<string | null> {
	if (source === "global") {
		const globalConfigDir = path.join(os.homedir(), ".jabberwock")
		return path.join(globalConfigDir, "commands")
	}

	if (getWorkspaceRoots().length === 0) {
		publishNotificationError(t("common:errors.no_workspace"))
		return null
	}

	const rootStore = ctx.rootStore as IBackendRootStore
	const workspaceRoot = rootStore.chat.activeTask?.cwd
	if (!workspaceRoot) {
		publishNotificationError(t("common:errors.no_workspace_for_project_command"))
		return null
	}

	return path.join(workspaceRoot, ".jabberwock", "commands")
}

export async function filePathExists(filePath: string): Promise<boolean> {
	return fs
		.access(filePath)
		.then(() => true)
		.catch(() => false)
}

export async function findAvailableCommandName(commandsDir: string): Promise<string> {
	let counter = 1
	let name = "new-command"
	while (await filePathExists(path.join(commandsDir, `${name}.md`))) {
		name = `new-command-${counter}`
		counter++
	}
	return name
}

export async function postCommandsUpdate(
	provider: import("@jabberwock/types").WebviewProvider,
	cwd: string,
): Promise<void> {
	const commands = await getCommands(cwd)
	const commandList = commands.map((cmd) => ({
		name: cmd.name,
		source: cmd.source,
		filePath: cmd.filePath,
		description: cmd.description,
		argumentHint: cmd.argumentHint,
	}))
	await sendCommands(provider, commandList)
}

export async function createCommandFile(
	provider: import("@jabberwock/types").WebviewProvider,
	rootStore: IBackendRootStore,
	payload: { text: string; values: { source: string } },
	ctx: IntentHandlerContext,
): Promise<void> {
	const source = payload.values?.source
	if (!source) {
		backendLog.info("Missing source for createCommand")
		return
	}

	const commandsDir = await resolveCommandsDir(source, ctx)
	if (!commandsDir) {
		return
	}

	await fs.mkdir(commandsDir, { recursive: true })

	const fileName = sanitizeCommandName(payload.text)
	const commandName = fileName || (await findAvailableCommandName(commandsDir))
	const filePath = path.join(commandsDir, `${commandName}.md`)

	if (await filePathExists(filePath)) {
		publishNotificationError(t("common:errors.command_already_exists", { commandName }))
		return
	}

	const templateContent = t("common:errors.command_template_content")
	await fs.writeFile(filePath, templateContent, "utf8")
	backendLog.info(`Created new command file: ${filePath}`)

	openFile(filePath)

	const cwd = rootStore.chat.activeTask?.cwd ?? ""
	await postCommandsUpdate(provider, cwd)
}
