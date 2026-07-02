import * as vscode from "vscode"
import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import { postStateToWebview } from "./messaging"
import { getVscodeContext } from "@features/foundation/vscode/context"
import { getBackendRootStore } from "@features/storeSingleton"
import { getProviderSettingsManager } from "@features/settings/models/provider-settings-manager/ProviderSettingsManager"
import { activateProviderProfile } from "@features/settings/models/api-config-store.profiles"
import { updateTaskHistory } from "@features/hist/actions"

export async function handleModeSwitch(provider: ProviderHandle, modeSlug: string): Promise<void> {
	const lockApiConfig = getVscodeContext().extensionContext.workspaceState.get<boolean>("lockApiConfigAcrossModes")

	await getVscodeContext().updateGlobalState("mode", modeSlug)

	if (!lockApiConfig) {
		await switchModeApiConfig(provider, modeSlug)
	}

	const currentTask = getBackendRootStore().chat.activeTask
	if (currentTask?.setTaskMode) {
		currentTask.setTaskMode(modeSlug)
	}

	if (currentTask) {
		try {
			await updateTaskHistory({ id: currentTask.taskId, mode: modeSlug })
		} catch {
			// Non-critical
		}
	}

	await postStateToWebview(provider)
}

async function switchModeApiConfig(provider: ProviderHandle, modeSlug: string): Promise<void> {
	const psm = getProviderSettingsManager()
	if (!psm) return

	const modeConfigId = await psm.getModeConfigId(modeSlug)
	if (modeConfigId) {
		const profiles = await psm.listConfig()
		const profile = profiles.find((p) => p.id === modeConfigId)
		if (profile) {
			await activateProviderProfile(provider, { name: profile.name })
			await getVscodeContext().updateGlobalState("currentApiConfigName", profile.name)
		}
	} else {
		const currentConfigName = getVscodeContext().getGlobalState("currentApiConfigName")
		if (currentConfigName) {
			const profiles = await psm.listConfig()
			const currentProfile = profiles.find((p) => p.name === currentConfigName)
			if (currentProfile) {
				await psm.setModeConfig(modeSlug, currentProfile.id)
			}
		}
	}
}
