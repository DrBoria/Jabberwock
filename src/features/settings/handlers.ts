import type { EventBridge } from "../../core/webview/EventBridge"
import type { WebviewMessage, Language, TelemetrySetting, ExperimentId } from "@jabberwock/types"
import { TelemetryService, getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"
import { changeLanguage, t } from "../../i18n"
import { Package } from "../../shared/package"
import { experimentDefault } from "../../shared/experiments"
import { Terminal } from "../../integrations/terminal/Terminal"
import { setTtsEnabled, setTtsSpeed } from "../../utils/tts"
import { openFile } from "../../integrations/misc/open-file"
import * as vscode from "vscode"
import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"
import { fileExistsAtPath } from "../../utils/fs"
import { getCommand } from "../../utils/commands"
import { resolveDefaultSaveUri, saveLastExportPath } from "../../utils/export"
import { getWorkspacePath } from "../../utils/path"

import { postStateToWebview } from "../foundation/window-manager/store"
export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

export const handlerMap: Record<string, HandlerFn> = {
	updateSettings: async (provider, message) => {
		if (!message.updatedSettings) {
			return
		}

		try {
			for (const [key, value] of Object.entries(message.updatedSettings)) {
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
					const mcpHub = await provider.getMcpHub()
					if (mcpHub) {
						await mcpHub.handleMcpEnabledChange(newValue as boolean)
					}
				} else if (key === "experiments") {
					if (!value) {
						continue
					}
					newValue = {
						...(provider.contextProxy.getGlobalState("experiments") ?? experimentDefault),
						...(value as Record<ExperimentId, boolean>),
					}
				} else if (key === "customSupportPrompts") {
					if (!value) {
						continue
					}
				}

				await (provider.contextProxy as { setValue: (key: string, value: unknown) => void }).setValue(
					key,
					newValue,
				)
			}

			// Include updated settings in the state push so the webview is immediately
			// aware of what changed (avoids stale local state in the UI).
			const settingsState: Record<string, unknown> = {}
			for (const [key] of Object.entries(message.updatedSettings)) {
				settingsState[key] = (provider.contextProxy as { getValue?: (key: string) => unknown }).getValue?.(key)
			}
			await postStateToWebview(provider, Object.keys(settingsState).length > 0 ? settingsState : undefined)
		} catch (error) {
			console.error(
				`[updateSettings] Error saving settings:`,
				error instanceof Error ? error.message : String(error),
			)
		}
	},

	didShowAnnouncement: async (provider, _message) => {
		await provider.updateGlobalState("lastShownAnnouncementId", provider.latestAnnouncementId)
		await postStateToWebview(provider)
	},

	getDismissedUpsells: async (provider, _message) => {
		const dismissedUpsells = provider.contextProxy.getGlobalState("dismissedUpsells") || []
		await provider.postMessageToWebview({
			type: "dismissedUpsells",
			list: dismissedUpsells,
		})
	},

	dismissUpsell: async (provider, message) => {
		if (message.upsellId) {
			try {
				const dismissedUpsells = provider.contextProxy.getGlobalState("dismissedUpsells") || []
				let updatedList = dismissedUpsells
				if (!dismissedUpsells.includes(message.upsellId)) {
					updatedList = [...dismissedUpsells, message.upsellId]
					await provider.updateGlobalState("dismissedUpsells", updatedList)
				}

				await provider.postMessageToWebview({
					type: "dismissedUpsells",
					list: updatedList,
				})
			} catch (error) {
				provider.log(`Failed to dismiss upsell: ${error instanceof Error ? error.message : String(error)}`)
			}
		}
	},

	openKeyboardShortcuts: async (_provider, message) => {
		const searchQuery = message.text || ""
		if (searchQuery) {
			await vscode.commands.executeCommand("workbench.action.openGlobalKeybindings", searchQuery)
		} else {
			await vscode.commands.executeCommand("workbench.action.openGlobalKeybindings")
		}
	},

	openMarkdownPreview: async (provider, message) => {
		if (message.text) {
			try {
				const tmpDir = os.tmpdir()
				const timestamp = Date.now()
				const tempFileName = `jabberwock-preview-${timestamp}.md`
				const tempFilePath = path.join(tmpDir, tempFileName)

				await fs.writeFile(tempFilePath, message.text, "utf8")

				const doc = await vscode.workspace.openTextDocument(tempFilePath)
				await vscode.commands.executeCommand("markdown.showPreview", doc.uri)
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				provider.log(`Error opening markdown preview: ${errorMessage}`)
				vscode.window.showErrorMessage(`Failed to open markdown preview: ${errorMessage}`)
			}
		}
	},

	telemetrySetting: async (provider, message) => {
		const telemetrySetting = message.text as TelemetrySetting
		const previousSetting = provider.contextProxy.getGlobalState("telemetrySetting") || "unset"
		const isOptedIn = telemetrySetting !== "disabled"
		const wasPreviouslyOptedIn = previousSetting !== "disabled"

		if (wasPreviouslyOptedIn && !isOptedIn && hasTelemetryService()) {
			getTelemetryService().captureTelemetrySettingsChanged(previousSetting, telemetrySetting)
		}

		await provider.updateGlobalState("telemetrySetting", telemetrySetting)

		if (hasTelemetryService()) {
			getTelemetryService().updateTelemetryState(isOptedIn)
		}

		if (!wasPreviouslyOptedIn && isOptedIn && hasTelemetryService()) {
			getTelemetryService().captureTelemetrySettingsChanged(previousSetting, telemetrySetting)
		}

		await postStateToWebview(provider)
	},

	terminalOperation: async (provider, message) => {
		if (message.terminalOperation) {
			provider.getCurrentTask()?.handleTerminalOperation(message.terminalOperation)
		}
	},

	showMdmAuthRequiredNotification: async (_provider, _message) => {
		vscode.window.showWarningMessage(t("common:mdm.info.organization_requires_auth"))
	},
}
