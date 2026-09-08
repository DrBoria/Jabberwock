import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import type { CreateTaskOptions, JabberwockSettings } from "@jabberwock/types"
import { Package } from "@shared/package"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { getBackendRootStore } from "@features/storeSingleton"
import { getBackendCapabilities } from "@features/foundation/capabilities/registry"
import { createTask } from "./create-task"

/**
 * Resolve the target webview provider for a new task (D4g-2 batch 4).
 *
 * When `newTab` is set, the host reverts/closes editors and opens a fresh webview tab through the
 * `openInNewTab` capability slot (the vscode connector backs it with the real `openClineInNewTab`;
 * server mode omits it, so the action degrades to an error). Otherwise the existing provider is
 * focused through the `hostCommands` slot. The shared backend never imports "vscode" directly.
 */
async function resolveTargetProvider(provider: ProviderHandle, newTab: boolean | undefined): Promise<ProviderHandle> {
	const capabilities = getBackendCapabilities()
	const hostCommands = capabilities.hostContext.hostCommands
	if (newTab) {
		hostCommands?.executeCommand?.("workbench.action.files.revert")
		hostCommands?.executeCommand?.("workbench.action.closeAllEditors")
		const openInNewTab = capabilities.openInNewTab
		if (!openInNewTab) {
			throw new Error("openInNewTab capability not available in this host")
		}
		return openInNewTab()
	}
	hostCommands?.executeCommand?.(`${Package.name}.SidebarProvider.focus`)
	return provider
}

export async function startNewTask(
	provider: ProviderHandle,
	options: {
		configuration: JabberwockSettings
		text?: string
		images?: string[]
		newTab?: boolean
	},
): Promise<string> {
	const { configuration, text, images, newTab } = options
	const targetProvider = await resolveTargetProvider(provider, newTab)

	const chatStore = getBackendRootStore().chat
	const activeTask = chatStore.activeTask

	if (activeTask) {
		chatStore.clearAllStreamingToolCalls()
		chatStore.removeTask(activeTask.taskId)
	}

	await postStateToWebview(targetProvider)
	await targetProvider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
	await targetProvider.postMessageToWebview({ type: "invoke", invoke: "newChat", text, images })

	const taskOptions: CreateTaskOptions = {
		consecutiveMistakeLimit: Number.MAX_SAFE_INTEGER,
	}

	const task = await createTask(targetProvider, text, images, { ...configuration, ...taskOptions }, undefined)

	if (!task) {
		throw new Error("Failed to create task due to policy restrictions")
	}

	return task.taskId
}
