import * as vscode from "vscode"
import * as path from "path"
import * as os from "os"
import * as fs from "fs/promises"
import type { EventBridge } from "../../../core/webview/EventBridge"
import type { WebviewMessage } from "@jabberwock/types"
import { t } from "../../../i18n"
import { openFile } from "../../../integrations/misc/open-file"
import { getMstState } from "../../foundation/mst/store"

export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

export const handlerMap: Record<string, HandlerFn> = {
	allowedCommands: async (provider, message) => {
		// Validate and sanitize the commands array
		const commands = message.commands ?? []
		const validCommands = Array.isArray(commands)
			? commands.filter((cmd) => typeof cmd === "string" && cmd.trim().length > 0)
			: []

		await provider.updateGlobalState("allowedCommands", validCommands)

		// Also update workspace settings.
		const { Package } = await import("../../../shared/package")
		await vscode.workspace
			.getConfiguration(Package.name)
			.update("allowedCommands", validCommands, vscode.ConfigurationTarget.Global)
	},

	deniedCommands: async (provider, message) => {
		// Validate and sanitize the commands array
		const commands = message.commands ?? []
		const validCommands = Array.isArray(commands)
			? commands.filter((cmd) => typeof cmd === "string" && cmd.trim().length > 0)
			: []

		await provider.updateGlobalState("deniedCommands", validCommands)

		// Also update workspace settings.
		const { Package } = await import("../../../shared/package")
		await vscode.workspace
			.getConfiguration(Package.name)
			.update("deniedCommands", validCommands, vscode.ConfigurationTarget.Global)
	},

	openCommandFile: async (provider, message) => {
		try {
			if (message.text) {
				const getCurrentCwd = () => {
					return provider.getCurrentTask()?.cwd || provider.cwd
				}
				const { getCommand } = await import("../../../services/command/commands")
				const command = await getCommand(getCurrentCwd(), message.text)

				if (command && command.filePath) {
					openFile(command.filePath)
				} else {
					vscode.window.showErrorMessage(t("common:errors.command_not_found", { name: message.text }))
				}
			}
		} catch (error) {
			provider.log(
				`Error opening command file: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			vscode.window.showErrorMessage(t("common:errors.open_command_file"))
		}
	},

	deleteCommand: async (provider, message) => {
		try {
			if (message.text && message.values?.source) {
				const getCurrentCwd = () => {
					return provider.getCurrentTask()?.cwd || provider.cwd
				}
				const { getCommand } = await import("../../../services/command/commands")
				const command = await getCommand(getCurrentCwd(), message.text)

				if (command && command.filePath) {
					// Delete the command file
					await fs.unlink(command.filePath)
					provider.log(`Deleted command file: ${command.filePath}`)
				} else {
					vscode.window.showErrorMessage(t("common:errors.command_not_found", { name: message.text }))
				}
			}
		} catch (error) {
			provider.log(
				`Error deleting command: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			vscode.window.showErrorMessage(t("common:errors.delete_command"))
		}
	},

	createCommand: async (provider, message) => {
		try {
			const source = message.values?.source as "global" | "project"
			const fileName = message.text // Custom filename from user input

			if (!source) {
				provider.log("Missing source for createCommand")
				return
			}

			// Determine the commands directory based on source
			let commandsDir: string
			if (source === "global") {
				const globalConfigDir = path.join(os.homedir(), ".jabberwock")
				commandsDir = path.join(globalConfigDir, "commands")
			} else {
				if (!vscode.workspace.workspaceFolders?.length) {
					vscode.window.showErrorMessage(t("common:errors.no_workspace"))
					return
				}
				// Project commands
				const getCurrentCwd = () => {
					return provider.getCurrentTask()?.cwd || provider.cwd
				}
				const workspaceRoot = getCurrentCwd()
				if (!workspaceRoot) {
					vscode.window.showErrorMessage(t("common:errors.no_workspace_for_project_command"))
					return
				}
				commandsDir = path.join(workspaceRoot, ".jabberwock", "commands")
			}

			// Ensure the commands directory exists
			await fs.mkdir(commandsDir, { recursive: true })

			// Use provided filename or generate a unique one
			let commandName: string
			if (fileName && fileName.trim()) {
				let cleanFileName = fileName.trim()

				// Strip leading slash if present
				if (cleanFileName.startsWith("/")) {
					cleanFileName = cleanFileName.substring(1)
				}

				// Remove .md extension if present BEFORE slugification
				if (cleanFileName.toLowerCase().endsWith(".md")) {
					cleanFileName = cleanFileName.slice(0, -3)
				}

				// Slugify the command name: lowercase, replace spaces with dashes, remove special characters
				commandName = cleanFileName
					.toLowerCase()
					.replace(/\s+/g, "-") // Replace spaces with dashes
					.replace(/[^a-z0-9-]/g, "") // Remove special characters except dashes
					.replace(/-+/g, "-") // Replace multiple dashes with single dash
					.replace(/^-|-$/g, "") // Remove leading/trailing dashes

				// Ensure we have a valid command name
				if (!commandName || commandName.length === 0) {
					commandName = "new-command"
				}
			} else {
				// Generate a unique command name
				commandName = "new-command"
				let counter = 1
				let filePath = path.join(commandsDir, `${commandName}.md`)

				while (
					await fs
						.access(filePath)
						.then(() => true)
						.catch(() => false)
				) {
					commandName = `new-command-${counter}`
					filePath = path.join(commandsDir, `${commandName}.md`)
					counter++
				}
			}

			const filePath = path.join(commandsDir, `${commandName}.md`)

			// Check if file already exists
			if (
				await fs
					.access(filePath)
					.then(() => true)
					.catch(() => false)
			) {
				vscode.window.showErrorMessage(t("common:errors.command_already_exists", { commandName }))
				return
			}

			// Create the command file with template content
			const templateContent = t("common:errors.command_template_content")

			await fs.writeFile(filePath, templateContent, "utf8")
			provider.log(`Created new command file: ${filePath}`)

			// Open the new file in the editor
			openFile(filePath)

			// Refresh commands list
			const { getCommands } = await import("../../../services/command/commands")
			const getCurrentCwd = () => {
				return provider.getCurrentTask()?.cwd || provider.cwd
			}
			const commands = await getCommands(getCurrentCwd() || "")
			const commandList = commands.map((command) => ({
				name: command.name,
				source: command.source,
				filePath: command.filePath,
				description: command.description,
				argumentHint: command.argumentHint,
			}))
			await provider.postMessageToWebview({
				type: "commands",
				commands: commandList,
			})
			// Dual-write: MST store
			getMstState(provider).commandsStore?.setCommands(commandList)
		} catch (error) {
			provider.log(
				`Error creating command: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			vscode.window.showErrorMessage(t("common:errors.create_command_failed"))
		}
	},

	insertTextIntoTextarea: async (provider, message) => {
		const text = message.text
		if (text) {
			// Send message to insert text into the chat textarea
			await provider.postMessageToWebview({
				type: "insertTextIntoTextarea",
				text: text,
			})
		}
	},
}
