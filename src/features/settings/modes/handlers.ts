import type { EventBridge } from "../../../core/webview/EventBridge"
import type { WebviewMessage } from "@jabberwock/types"
import { TelemetryService, getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"
import { defaultModeSlug, getAllModes } from "../../../shared/modes"
import { openFile } from "../../../integrations/misc/open-file"
import { t } from "../../../i18n"
import * as vscode from "vscode"
import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"
import { fileExistsAtPath } from "../../../utils/fs"
import { getWorkspacePath } from "../../../utils/path"
import { resolveDefaultSaveUri, saveLastExportPath } from "../../../utils/export"

import { postStateToWebview } from "../../foundation/window-manager/store"
export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

export const handlerMap: Record<string, HandlerFn> = {
	updateCustomMode: async (provider, message) => {
		if (message.modeConfig) {
			try {
				const existingModes = await provider.customModesManager!.getCustomModes()
				const isNewMode = !existingModes.some((mode) => mode.slug === message.modeConfig?.slug)

				await provider.customModesManager!.updateCustomMode(message.modeConfig.slug, message.modeConfig)
				const customModes = await provider.customModesManager!.getCustomModes()
				await provider.updateGlobalState("customModes", customModes)
				await provider.updateGlobalState("mode", message.modeConfig.slug)
				await postStateToWebview(provider)

				if (hasTelemetryService()) {
					if (isNewMode) {
						getTelemetryService().captureCustomModeCreated(message.modeConfig.slug, message.modeConfig.name)
					} else {
						const existingMode = existingModes.find((mode) => mode.slug === message.modeConfig?.slug)
						const changedSettings = existingMode
							? Object.keys(message.modeConfig).filter(
									(key) =>
										JSON.stringify((existingMode as Record<string, unknown>)[key]) !==
										JSON.stringify((message.modeConfig as Record<string, unknown>)[key]),
								)
							: []

						if (changedSettings.length > 0) {
							getTelemetryService().captureModeSettingChanged(changedSettings[0])
						}
					}
				}
			} catch (error) {
				// Error already shown to user by updateCustomMode
			}
		}
	},

	deleteCustomMode: async (provider, message) => {
		if (message.slug) {
			const customModes = await provider.customModesManager!.getCustomModes()
			const modeToDelete = customModes.find((mode) => mode.slug === message.slug)

			if (!modeToDelete) {
				return
			}

			const scope = modeToDelete.source || "global"

			let rulesFolderPath: string
			if (scope === "project") {
				const workspacePath = getWorkspacePath()
				if (workspacePath) {
					rulesFolderPath = path.join(workspacePath, ".jabberwock", `rules-${message.slug}`)
				} else {
					rulesFolderPath = path.join(".jabberwock", `rules-${message.slug}`)
				}
			} else {
				const homeDir = os.homedir()
				rulesFolderPath = path.join(homeDir, ".jabberwock", `rules-${message.slug}`)
			}

			const rulesFolderExists = await fileExistsAtPath(rulesFolderPath)

			if (message.checkOnly) {
				await provider.postMessageToWebview({
					type: "deleteCustomModeCheck",
					slug: message.slug,
					rulesFolderPath: rulesFolderExists ? rulesFolderPath : undefined,
				})
				return
			}

			await provider.customModesManager!.deleteCustomMode(message.slug)

			if (rulesFolderExists) {
				try {
					await fs.rm(rulesFolderPath, { recursive: true, force: true })
					provider.log(`Deleted rules folder for mode ${message.slug}: ${rulesFolderPath}`)
				} catch (error) {
					provider.log(`Failed to delete rules folder for mode ${message.slug}: ${error}`)
					vscode.window.showErrorMessage(
						t("common:errors.delete_rules_folder_failed", {
							rulesFolderPath,
							error: error instanceof Error ? error.message : String(error),
						}),
					)
				}
			}

			await provider.updateGlobalState("mode", defaultModeSlug)
			await postStateToWebview(provider)
		}
	},

	exportMode: async (provider, message) => {
		if (message.slug) {
			try {
				const customModePrompts = provider.contextProxy.getGlobalState("customModePrompts") || {}
				const customPrompt = customModePrompts[message.slug]

				const result = await provider.customModesManager!.exportModeWithRules(message.slug, customPrompt)

				if (result.success && result.yaml) {
					const defaultUri = await resolveDefaultSaveUri(
						provider.contextProxy,
						"lastModeExportPath",
						`${message.slug}-export.yaml`,
						{
							useWorkspace: true,
							fallbackDir: path.join(os.homedir(), "Downloads"),
						},
					)

					const saveUri = await vscode.window.showSaveDialog({
						defaultUri,
						filters: {
							"YAML files": ["yaml", "yml"],
						},
						title: "Save mode export",
					})

					if (saveUri && result.yaml) {
						await saveLastExportPath(provider.contextProxy, "lastModeExportPath", saveUri)
						await fs.writeFile(saveUri.fsPath, result.yaml, "utf-8")
						provider.postMessageToWebview({
							type: "exportModeResult",
							success: true,
							slug: message.slug,
						})

						vscode.window.showInformationMessage(t("common:info.mode_exported", { mode: message.slug }))
					} else {
						provider.postMessageToWebview({
							type: "exportModeResult",
							success: false,
							error: "Export cancelled",
							slug: message.slug,
						})
					}
				} else {
					provider.postMessageToWebview({
						type: "exportModeResult",
						success: false,
						error: result.error,
						slug: message.slug,
					})
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				provider.log(`Failed to export mode ${message.slug}: ${errorMessage}`)
				provider.postMessageToWebview({
					type: "exportModeResult",
					success: false,
					error: errorMessage,
					slug: message.slug,
				})
			}
		}
	},

	importMode: async (provider, message) => {
		try {
			const lastImportPath = provider.contextProxy.getGlobalState("lastModeImportPath")
			let defaultUri: vscode.Uri | undefined

			if (lastImportPath) {
				const lastDir = path.dirname(lastImportPath)
				defaultUri = vscode.Uri.file(lastDir)
			} else {
				const workspaceFolders = vscode.workspace.workspaceFolders
				if (workspaceFolders && workspaceFolders.length > 0) {
					defaultUri = vscode.Uri.file(workspaceFolders[0].uri.fsPath)
				}
			}

			const fileUri = await vscode.window.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				defaultUri,
				filters: {
					"YAML files": ["yaml", "yml"],
				},
				title: "Select mode export file to import",
			})

			if (fileUri && fileUri[0]) {
				await provider.updateGlobalState("lastModeImportPath", fileUri[0].fsPath)

				const yamlContent = await fs.readFile(fileUri[0].fsPath, "utf-8")

				const result = await provider.customModesManager!.importModeWithRules(
					yamlContent,
					message.source || "project",
				)

				if (result.success) {
					const customModes = await provider.customModesManager!.getCustomModes()
					await provider.updateGlobalState("customModes", customModes)
					await postStateToWebview(provider)
					provider.postMessageToWebview({
						type: "importModeResult",
						success: true,
						slug: result.slug,
					})

					vscode.window.showInformationMessage(t("common:info.mode_imported"))
				} else {
					provider.postMessageToWebview({
						type: "importModeResult",
						success: false,
						error: result.error,
					})

					vscode.window.showErrorMessage(t("common:errors.mode_import_failed", { error: result.error }))
				}
			} else {
				provider.postMessageToWebview({
					type: "importModeResult",
					success: false,
					error: "cancelled",
				})
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			provider.log(`Failed to import mode: ${errorMessage}`)
			provider.postMessageToWebview({
				type: "importModeResult",
				success: false,
				error: errorMessage,
			})

			vscode.window.showErrorMessage(t("common:errors.mode_import_failed", { error: errorMessage }))
		}
	},

	checkRulesDirectory: async (provider, message) => {
		if (message.slug) {
			const hasContent = await provider.customModesManager!.checkRulesDirectoryHasContent(message.slug)

			provider.postMessageToWebview({
				type: "checkRulesDirectoryResult",
				slug: message.slug,
				hasContent,
			})
		}
	},

	hasOpenedModeSelector: async (provider, message) => {
		await provider.updateGlobalState("hasOpenedModeSelector", message.bool ?? true)
		await postStateToWebview(provider)
	},

	requestModes: async (provider, _message) => {
		try {
			const customModes = await provider.customModesManager?.getCustomModes()
			const modes = getAllModes(customModes) as { slug: string; name: string }[]
			await provider.postMessageToWebview({ type: "modes", modes })
		} catch (error) {
			provider.log(`Error fetching modes: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
			await provider.postMessageToWebview({ type: "modes", modes: [] })
		}
	},

	openCustomModesSettings: async (provider, _message) => {
		const customModesFilePath = await provider.customModesManager?.getCustomModesFilePath()

		if (customModesFilePath) {
			openFile(customModesFilePath)
		}
	},
}
