import * as vscode from "vscode"
import { configure } from "mobx"

import { getOrCreateTelemetryService, PostHogTelemetryClient } from "@jabberwock/telemetry"
import { customToolRegistry } from "@jabberwock/core"

import { createOutputChannelLogger, createDualLogger } from "@utils/logger"
import { initializeNetworkProxy } from "@utils/network-proxy"
import { Package } from "@shared/package"
import { installBackendState, getHostEnvironment } from "@features/foundation/host-context/context"
import { runSettingsMigrations } from "@features/settings/actions/runMigrations"
import { openAiCodexOAuthManager } from "@integrations/openai-codex/oauth"
import { migrateSettings } from "@utils/settings"
import { initializeI18n } from "@i18n"
import { formatLanguage } from "@shared/language"
import { getCodeIndexManager } from "@services/code-index/manager/manager.factory"
import { MdmService } from "@services/mdm/MdmService"

export async function initializeCoreSetup(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
): Promise<{
	telemetryService: ReturnType<typeof getOrCreateTelemetryService>
	cloudLogger: ReturnType<typeof createDualLogger>
	mdmService: MdmService
}> {
	configure({ isolateGlobalState: true })

	await initializeNetworkProxy(context, outputChannel)
	customToolRegistry.setExtensionPath(context.extensionPath)
	await migrateSettings()

	const telemetryService = getOrCreateTelemetryService()
	try {
		telemetryService.register(
			new PostHogTelemetryClient(false, {
				machineId: vscode.env.machineId,
				getTelemetryLevel: () =>
					vscode.workspace.getConfiguration("telemetry").get<string>("telemetryLevel", "all") ?? "all",
			}),
		)
	} catch (error) {
		console.warn("[jabberwock] Failed to register PostHogTelemetryClient:", error)
	}

	const cloudLogger = createDualLogger(createOutputChannelLogger())

	const mdmService = new MdmService(cloudLogger)
	await mdmService.initialize()

	initializeI18n(context.globalState.get("language") ?? formatLanguage(vscode.env.language))
	openAiCodexOAuthManager.initialize(context, (message) => outputChannel.appendLine(message))

	const defaultCommands = vscode.workspace.getConfiguration(Package.name).get<string[]>("allowedCommands") || []
	if (!context.globalState.get("allowedCommands")) {
		context.globalState.update("allowedCommands", defaultCommands)
	}

	installBackendState(context)
	await runSettingsMigrations(context)

	return { telemetryService, cloudLogger, mdmService }
}

export function initializeCodeIndexManagers(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
): void {
	if (!vscode.workspace.workspaceFolders) return

	for (const folder of vscode.workspace.workspaceFolders) {
		const manager = getCodeIndexManager(context, folder.uri.fsPath)
		if (!manager) continue

		void manager.initialize(getHostEnvironment()).catch((error) => {
			const message = error instanceof Error ? error.message : String(error)
			outputChannel.appendLine(
				`[CodeIndexManager] Error during background CodeIndexManager configuration/indexing for ${folder.uri.fsPath}: ${message}`,
			)
		})

		context.subscriptions.push(manager)
	}
}
