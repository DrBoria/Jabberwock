import * as vscode from "vscode"
import { randomUUID } from "crypto"

import { IntentType, IntentStatus } from "@jabberwock/types"

import { getBackendRootStore } from "@features/storeSingleton"
import { initModesFileService } from "@features/settings/agents/modes-file-service/mock"
import {
	loadAndMergeModes,
	getCustomModesFilePath,
	getWorkspaceRoomodes,
} from "@features/settings/agents/modes-file-service/file-ops"

export async function setupAgentsFileService(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
): Promise<void> {
	initModesFileService(context)
	await loadAndMergeModes(context)
	outputChannel.appendLine("[extension] Agents file service initialized and modes loaded into store")

	const settingsPath = await getCustomModesFilePath(context)
	const settingsWatcher = vscode.workspace.createFileSystemWatcher(settingsPath)
	const handleModeFileChange = async () => {
		try {
			getBackendRootStore().intentStore.createIntent({
				id: randomUUID(),
				type: IntentType.SettingsModeFileChanged,
				payload: {},
				status: IntentStatus.Queued,
				createdAt: Date.now(),
			})
		} catch (error) {
			console.error("[jabberwock] [extension] Failed to dispatch SettingsModeFileChanged intent:", error)
		}
	}
	settingsWatcher.onDidChange(handleModeFileChange)
	settingsWatcher.onDidCreate(handleModeFileChange)
	settingsWatcher.onDidDelete(handleModeFileChange)
	context.subscriptions.push(settingsWatcher)

	const roomodesPath = await getWorkspaceRoomodes()
	if (roomodesPath) {
		const roomodesWatcher = vscode.workspace.createFileSystemWatcher(roomodesPath)
		roomodesWatcher.onDidChange(handleModeFileChange)
		roomodesWatcher.onDidCreate(handleModeFileChange)
		roomodesWatcher.onDidDelete(handleModeFileChange)
		context.subscriptions.push(roomodesWatcher)
	}
	outputChannel.appendLine("[extension] File watchers for agents files registered")
}
