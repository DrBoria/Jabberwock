import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../intents/bus"
import type { Language, TelemetrySetting, ExperimentId, JabberwockSettings } from "@jabberwock/types"
import { TelemetryService, getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"
import { changeLanguage, t } from "../../../i18n"
import { Package } from "../../../shared/package"
import { experimentDefault } from "../../../shared/experiments"
import { Terminal } from "../../../integrations/terminal/Terminal"
import { setTtsEnabled, setTtsSpeed } from "../../../utils/tts"
import { openFile } from "../../../integrations/misc/open-file"
import * as vscode from "vscode"
import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"
import { getVscodeContext } from "../../foundation/vscode/context"
import { getSettingsAccess } from "@utils/settings-access"
import { getMcpServerManager } from "../../../services/mcp/McpServerManager"
import { fileExistsAtPath } from "../../../utils/fs"
import { getCommand, getCommands } from "../../../services/command/commands"
import { getWorkspacePath } from "../../../utils/path"
import { getTaskDirectoryPath } from "../../../utils/storage"
import { postStateToWebview, WebviewStatePayload } from "@features/foundation/window-manager/store"
import { getMstState } from "../../foundation/mst/store"
import { generateErrorDiagnostics } from "./on-diagnostics"
import type { ErrorDiagnosticsValues } from "./on-diagnostics"
import { openAiCodexOAuthManager } from "../../../integrations/openai-codex/oauth"
import { fetchOpenAiCodexRateLimitInfo } from "../../../integrations/openai-codex/rate-limits"
import { EventBridge } from "@features/foundation/webview/EventBridge"

/**
 * Register all core settings intent handlers (from the old settings/handlers.ts).
 */
export function registerOnSettingsCore(bus: IntentBus): void {
	// ── updateSettings ────────────────────────────────────────────────
	bus.register(IntentType.SettingsUpdate, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { updatedSettings: { [key: string]: unknown } }
		if (!payload.updatedSettings) return

		try {
			for (const [key, value] of Object.entries(payload.updatedSettings)) {
				let newValue = value

				if (key === "language") {
					newValue = value ?? "en"
					changeLanguage(newValue as Language)
				} else if (key === "allowedCommands") {
					const commands = value ?? []
					newValue = Array.isArray(commands)
						? commands.filter((cmd) => typeof cmd === "string" && cmd.trim().length > 0)
						: []

					await vscode.workspace
						.getConfiguration(Package.name)
						.update("allowedCommands", newValue, vscode.ConfigurationTarget.Global)
				} else if (key === "deniedCommands") {
					const commands = value ?? []
					newValue = Array.isArray(commands)
						? commands.filter((cmd) => typeof cmd === "string" && cmd.trim().length > 0)
						: []

					await vscode.workspace
						.getConfiguration(Package.name)
						.update("deniedCommands", newValue, vscode.ConfigurationTarget.Global)
				} else if (key === "ttsEnabled") {
					newValue = value ?? true
					setTtsEnabled(newValue as boolean)
				} else if (key === "ttsSpeed") {
					newValue = value ?? 1.0
					setTtsSpeed(newValue as number)
				} else if (key === "terminalShellIntegrationTimeout") {
					if (value !== undefined) {
						Terminal.setShellIntegrationTimeout(value as number)
					}
				} else if (key === "terminalShellIntegrationDisabled") {
					if (value !== undefined) {
						Terminal.setShellIntegrationDisabled(value as boolean)
					}
				} else if (key === "terminalCommandDelay") {
					if (value !== undefined) {
						Terminal.setCommandDelay(value as number)
					}
				} else if (key === "terminalPowershellCounter") {
					if (value !== undefined) {
						Terminal.setPowershellCounter(value as boolean)
					}
				} else if (key === "terminalZshClearEolMark") {
					if (value !== undefined) {
						Terminal.setTerminalZshClearEolMark(value as boolean)
					}
				} else if (key === "terminalZshOhMy") {
					if (value !== undefined) {
						Terminal.setTerminalZshOhMy(value as boolean)
					}
				} else if (key === "terminalZshP10k") {
					if (value !== undefined) {
						Terminal.setTerminalZshP10k(value as boolean)
					}
				} else if (key === "terminalZdotdir") {
					if (value !== undefined) {
						Terminal.setTerminalZdotdir(value as boolean)
					}
				} else if (key === "execaShellPath") {
					Terminal.setExecaShellPath(value as string | undefined)
				} else if (key === "mcpEnabled") {
					newValue = value ?? true
					const mcpHub = await getMcpServerManager().getMcpHub()
					if (mcpHub) {
						await mcpHub.handleMcpEnabledChange(newValue as boolean)
					}
				} else if (key === "experiments") {
					if (!value) continue
					newValue = {
						...(getVscodeContext().getGlobalState("experiments") ?? experimentDefault),
						...(value as Record<ExperimentId, boolean>),
					}
				} else if (key === "customSupportPrompts") {
					if (!value) continue
				}

				await getSettingsAccess().setValue(
					key as keyof JabberwockSettings,
					newValue as JabberwockSettings[keyof JabberwockSettings],
				)
			}

			const settingsState: WebviewStatePayload = {}
			for (const [key] of Object.entries(payload.updatedSettings)) {
				settingsState[key] = getSettingsAccess().getValue(key as keyof JabberwockSettings)
			}
			await postStateToWebview(provider, Object.keys(settingsState).length > 0 ? settingsState : undefined)
		} catch (error) {
			console.error(
				`[jabberwock] [updateSettings] Error saving settings:`,
				error instanceof Error ? error.message : String(error),
			)
		}
	})

	// ── didShowAnnouncement ───────────────────────────────────────────
	bus.register(IntentType.SettingsAnnouncementShown, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return
		await postStateToWebview(provider)
	})

	// ── getDismissedUpsells ───────────────────────────────────────────
	bus.register(IntentType.SettingsUpsellsDismissedGet, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return
		const dismissedUpsells = getVscodeContext().getGlobalState("dismissedUpsells") || []
		await provider.postMessageToWebview({
			type: "dismissedUpsells",
			list: dismissedUpsells,
		})
	})

	// ── dismissUpsell ─────────────────────────────────────────────────
	bus.register(IntentType.SettingsUpsellDismiss, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return
		const payload = intent.payload as { upsellId: string }
		if (!payload.upsellId) return

		try {
			const dismissedUpsells = getVscodeContext().getGlobalState("dismissedUpsells") || []
			let updatedList = dismissedUpsells
			if (!dismissedUpsells.includes(payload.upsellId)) {
				updatedList = [...dismissedUpsells, payload.upsellId]
				await getVscodeContext().updateGlobalState("dismissedUpsells", updatedList)
			}

			await provider.postMessageToWebview({
				type: "dismissedUpsells",
				list: updatedList,
			})
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Failed to dismiss upsell: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	})

	// ── openKeyboardShortcuts ─────────────────────────────────────────
	bus.register(IntentType.SettingsKeyboardShortcutsOpen, async (intent, _ctx) => {
		const payload = intent.payload as { text?: string }
		const searchQuery = payload.text || ""
		if (searchQuery) {
			await vscode.commands.executeCommand("workbench.action.openGlobalKeybindings", searchQuery)
		} else {
			await vscode.commands.executeCommand("workbench.action.openGlobalKeybindings")
		}
	})

	// ── openMarkdownPreview ───────────────────────────────────────────
	bus.register(IntentType.SettingsMarkdownPreviewOpen, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return
		const payload = intent.payload as { text: string }
		if (!payload.text) return

		try {
			const tmpDir = os.tmpdir()
			const timestamp = Date.now()
			const tempFileName = `jabberwock-preview-${timestamp}.md`
			const tempFilePath = path.join(tmpDir, tempFileName)

			await fs.writeFile(tempFilePath, payload.text, "utf8")

			const doc = await vscode.workspace.openTextDocument(tempFilePath)
			await vscode.commands.executeCommand("markdown.showPreview", doc.uri)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			EventBridge.outputChannel?.appendLine(`Error opening markdown preview: ${errorMessage}`)
			vscode.window.showErrorMessage(`Failed to open markdown preview: ${errorMessage}`)
		}
	})

	// ── telemetrySetting ──────────────────────────────────────────────
	bus.register(IntentType.SettingsTelemetrySet, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return
		const payload = intent.payload as { text: string }
		const telemetrySetting = payload.text as TelemetrySetting
		const previousSetting = getVscodeContext().getGlobalState("telemetrySetting") || "unset"
		const isOptedIn = telemetrySetting !== "disabled"
		const wasPreviouslyOptedIn = previousSetting !== "disabled"

		if (wasPreviouslyOptedIn && !isOptedIn && hasTelemetryService()) {
			getTelemetryService().captureTelemetrySettingsChanged(previousSetting, telemetrySetting)
		}

		await getVscodeContext().updateGlobalState("telemetrySetting", telemetrySetting)

		if (hasTelemetryService()) {
			getTelemetryService().updateTelemetryState(isOptedIn)
		}

		if (!wasPreviouslyOptedIn && isOptedIn && hasTelemetryService()) {
			getTelemetryService().captureTelemetrySettingsChanged(previousSetting, telemetrySetting)
		}

		await postStateToWebview(provider)
	})

	// ── terminalOperation ─────────────────────────────────────────────
	bus.register(IntentType.SettingsTerminalOperationAction, async (intent, ctx) => {
		const payload = intent.payload as { terminalOperation: unknown }
		if (payload.terminalOperation) {
			ctx.rootStore.chat.activeTask?.handleTerminalOperation(payload.terminalOperation)
		}
	})

	// ── showMdmAuthRequiredNotification ───────────────────────────────
	bus.register(IntentType.SettingsMdmAuthNotification, async (_intent, _ctx) => {
		vscode.window.showWarningMessage(t("common:mdm.info.organization_requires_auth"))
	})

	// ── allowedCommands ───────────────────────────────────────────────
	bus.register(IntentType.SettingsCommandsAllowedSet, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return
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

	// ── deniedCommands ────────────────────────────────────────────────
	bus.register(IntentType.SettingsCommandsDeniedSet, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return
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

	// ── openCommandFile ───────────────────────────────────────────────
	bus.register(IntentType.SettingsCommandsFileOpen, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return
		const payload = intent.payload as { text: string }

		try {
			if (payload.text) {
				const getCurrentCwd = (): string => {
					return ctx.rootStore.chat.activeTask?.cwd ?? ""
				}
				const command = await getCommand(getCurrentCwd(), payload.text)

				if (command && command.filePath) {
					openFile(command.filePath)
				} else {
					vscode.window.showErrorMessage(t("common:errors.command_not_found", { name: payload.text }))
				}
			}
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error opening command file: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			vscode.window.showErrorMessage(t("common:errors.open_command_file"))
		}
	})

	// ── deleteCommand ─────────────────────────────────────────────────
	bus.register(IntentType.SettingsCommandsDelete, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return
		const payload = intent.payload as { text: string; values?: { source: string } }

		try {
			if (payload.text && payload.values?.source) {
				const getCurrentCwd = (): string => {
					return ctx.rootStore.chat.activeTask?.cwd ?? ""
				}
				const command = await getCommand(getCurrentCwd(), payload.text)

				if (command && command.filePath) {
					await fs.unlink(command.filePath)
					EventBridge.outputChannel?.appendLine(`Deleted command file: ${command.filePath}`)
				} else {
					vscode.window.showErrorMessage(t("common:errors.command_not_found", { name: payload.text }))
				}
			}
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error deleting command: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			vscode.window.showErrorMessage(t("common:errors.delete_command"))
		}
	})

	// ── createCommand ─────────────────────────────────────────────────
	bus.register(IntentType.SettingsCommandsCreate, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return
		const payload = intent.payload as { text: string; values: { source: string } }

		try {
			const source = payload.values?.source as "global" | "project"
			const fileName = payload.text

			if (!source) {
				EventBridge.outputChannel?.appendLine("Missing source for createCommand")
				return
			}

			let commandsDir: string
			if (source === "global") {
				const globalConfigDir = path.join(os.homedir(), ".jabberwock")
				commandsDir = path.join(globalConfigDir, "commands")
			} else {
				if (!vscode.workspace.workspaceFolders?.length) {
					vscode.window.showErrorMessage(t("common:errors.no_workspace"))
					return
				}
				const getCurrentCwd = () => {
					return ctx.rootStore.chat.activeTask?.cwd
				}
				const workspaceRoot = getCurrentCwd()
				if (!workspaceRoot) {
					vscode.window.showErrorMessage(t("common:errors.no_workspace_for_project_command"))
					return
				}
				commandsDir = path.join(workspaceRoot, ".jabberwock", "commands")
			}

			await fs.mkdir(commandsDir, { recursive: true })

			let commandName: string
			if (fileName && fileName.trim()) {
				let cleanFileName = fileName.trim()
				if (cleanFileName.startsWith("/")) {
					cleanFileName = cleanFileName.substring(1)
				}
				if (cleanFileName.toLowerCase().endsWith(".md")) {
					cleanFileName = cleanFileName.slice(0, -3)
				}
				commandName = cleanFileName
					.toLowerCase()
					.replace(/\s+/g, "-")
					.replace(/[^a-z0-9-]/g, "")
					.replace(/-+/g, "-")
					.replace(/^-|-$/g, "")
				if (!commandName || commandName.length === 0) {
					commandName = "new-command"
				}
			} else {
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

			if (
				await fs
					.access(filePath)
					.then(() => true)
					.catch(() => false)
			) {
				vscode.window.showErrorMessage(t("common:errors.command_already_exists", { commandName }))
				return
			}

			const templateContent = t("common:errors.command_template_content")
			await fs.writeFile(filePath, templateContent, "utf8")
			EventBridge.outputChannel?.appendLine(`Created new command file: ${filePath}`)

			openFile(filePath)

			const getCurrentCwd = () => {
				return ctx.rootStore.chat.activeTask?.cwd
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
			getMstState(ctx.rootStore).commandsStore?.setCommands(commandList)
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error creating command: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			vscode.window.showErrorMessage(t("common:errors.create_command_failed"))
		}
	})

	// ── insertTextIntoTextarea ────────────────────────────────────────
	bus.register(IntentType.SettingsTextareaTextInsert, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return
		const payload = intent.payload as { text: string }
		if (payload.text) {
			await provider.postMessageToWebview({
				type: "insertTextIntoTextarea",
				text: payload.text,
			})
		}
	})

	// ── requestOpenAiCodexRateLimits ──────────────────────────────────
	bus.register(IntentType.SettingsOpenaiCodexRateLimits, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const accessToken = await openAiCodexOAuthManager.getAccessToken()
			if (!accessToken) {
				provider.postMessageToWebview({
					type: "openAiCodexRateLimits",
					error: "Not authenticated with OpenAI Codex",
				})
				return
			}

			const accountId = await openAiCodexOAuthManager.getAccountId()
			const rateLimits = await fetchOpenAiCodexRateLimitInfo(accessToken, { accountId })

			provider.postMessageToWebview({
				type: "openAiCodexRateLimits",
				values: rateLimits,
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			EventBridge.outputChannel?.appendLine(`Error fetching OpenAI Codex rate limits: ${errorMessage}`)
			provider.postMessageToWebview({
				type: "openAiCodexRateLimits",
				error: errorMessage,
			})
		}
	})

	// ── openDebugApiHistory ───────────────────────────────────────────
	bus.register(IntentType.SettingsDebugApiHistoryOpen, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return
		const currentTask = ctx.rootStore.chat.activeTask
		if (!currentTask) {
			vscode.window.showErrorMessage("No active task to view history for")
			return
		}

		try {
			const globalStoragePath = getVscodeContext().globalStorageUri.fsPath
			const taskDirPath = await getTaskDirectoryPath(globalStoragePath, currentTask.taskId)

			const fileName = "api_conversation_history.json"
			const sourceFilePath = path.join(taskDirPath, fileName)

			if (!(await fileExistsAtPath(sourceFilePath))) {
				vscode.window.showErrorMessage(`File not found: ${fileName}`)
				return
			}

			const content = await fs.readFile(sourceFilePath, "utf8")
			let jsonContent: unknown

			try {
				jsonContent = JSON.parse(content)
			} catch {
				vscode.window.showErrorMessage(`Failed to parse ${fileName}`)
				return
			}

			const prettifiedContent = JSON.stringify(jsonContent, null, 2)

			const tmpDir = os.tmpdir()
			const timestamp = Date.now()
			const tempFileName = `jabberwock-debug-api-${currentTask.taskId.slice(0, 8)}-${timestamp}.json`
			const tempFilePath = path.join(tmpDir, tempFileName)

			await fs.writeFile(tempFilePath, prettifiedContent, "utf8")

			const doc = await vscode.workspace.openTextDocument(tempFilePath)
			await vscode.window.showTextDocument(doc, { preview: true })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			EventBridge.outputChannel?.appendLine(`Error opening debug history: ${errorMessage}`)
			vscode.window.showErrorMessage(`Failed to open debug history: ${errorMessage}`)
		}
	})

	// ── openDebugUiHistory ────────────────────────────────────────────
	bus.register(IntentType.SettingsDebugUiHistoryOpen, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return
		const currentTask = ctx.rootStore.chat.activeTask
		if (!currentTask) {
			vscode.window.showErrorMessage("No active task to view history for")
			return
		}

		try {
			const globalStoragePath = getVscodeContext().globalStorageUri.fsPath
			const taskDirPath = await getTaskDirectoryPath(globalStoragePath, currentTask.taskId)

			const fileName = "ui_messages.json"
			const sourceFilePath = path.join(taskDirPath, fileName)

			if (!(await fileExistsAtPath(sourceFilePath))) {
				vscode.window.showErrorMessage(`File not found: ${fileName}`)
				return
			}

			const content = await fs.readFile(sourceFilePath, "utf8")
			let jsonContent: unknown

			try {
				jsonContent = JSON.parse(content)
			} catch {
				vscode.window.showErrorMessage(`Failed to parse ${fileName}`)
				return
			}

			const prettifiedContent = JSON.stringify(jsonContent, null, 2)

			const tmpDir = os.tmpdir()
			const timestamp = Date.now()
			const tempFileName = `jabberwock-debug-ui-${currentTask.taskId.slice(0, 8)}-${timestamp}.json`
			const tempFilePath = path.join(tmpDir, tempFileName)

			await fs.writeFile(tempFilePath, prettifiedContent, "utf8")

			const doc = await vscode.workspace.openTextDocument(tempFilePath)
			await vscode.window.showTextDocument(doc, { preview: true })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			EventBridge.outputChannel?.appendLine(`Error opening debug history: ${errorMessage}`)
			vscode.window.showErrorMessage(`Failed to open debug history: ${errorMessage}`)
		}
	})

	// ── downloadErrorDiagnostics ──────────────────────────────────────
	bus.register(IntentType.SettingsDiagnosticsDownload, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return
		const payload = intent.payload as { values: unknown }
		const currentTask = ctx.rootStore.chat.activeTask
		if (!currentTask) {
			vscode.window.showErrorMessage("No active task to generate diagnostics for")
			return
		}

		await generateErrorDiagnostics({
			taskId: currentTask.taskId,
			globalStoragePath: getVscodeContext().globalStorageUri.fsPath,
			values: payload.values as ErrorDiagnosticsValues | undefined,
			log: (msg: string) => EventBridge.outputChannel?.appendLine(msg),
		})
	})
}
