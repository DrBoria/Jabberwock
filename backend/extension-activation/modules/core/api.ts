import * as vscode from "vscode"
import * as path from "path"
import { EventEmitter } from "events"

import type {
	JabberwockAPI,
	JabberwockAPIEvents,
	JabberwockSettings,
	ProviderSettings,
	ProviderSettingsEntry,
} from "@jabberwock/types"

import { EventBridge } from "@features/foundation/webview/EventBridge"
import { getBackendRootStore } from "@features/storeSingleton"
import { startNewTask, createTaskWithHistoryItem } from "@features/chat/task/actions/startTask"
import { isTaskInHistory, getCurrentTaskStack } from "@features/chat/task/actions/taskRegistry"
import { popTaskFromStack, abortRunningTask } from "@features/chat/task/actions/abortRunningTask"
import { sendMessage } from "@features/chat/task/messages/actions/sendMessage"
import { healthcheck } from "@features/foundation/window-manager/actions/ready"
import { getTaskWithId } from "@features/hist/actions"
import { getConfiguration, setConfiguration } from "@features/settings/models/api-config-store"
import {
	createProviderProfile,
	updateProviderProfile,
	deleteProviderProfile,
	upsertProviderProfile,
	setActiveProfile,
} from "@features/settings/models/api-config-store.profiles"

export function setupDevWatchers(context: vscode.ExtensionContext): void {
	if (process.env.NODE_ENV !== "development") return

	const watchPaths = [
		{ p: context.extensionPath, pattern: "**/*.ts" },
		{ p: path.join(context.extensionPath, "../packages/types"), pattern: "**/*.ts" },
		{ p: path.join(context.extensionPath, "../packages/telemetry"), pattern: "**/*.ts" },
		{ p: path.join(context.extensionPath, "node_modules/@jabberwock/cloud"), pattern: "**/*" },
	]

	console.log(`♻️♻️♻️ Core auto-reloading: Watching for changes in ${watchPaths.map(({ p }) => p).join(", ")}`)

	let reloadTimeout: NodeJS.Timeout | undefined
	const DEBOUNCE_DELAY = 1_000

	const debouncedReload = (uri: vscode.Uri) => {
		if (reloadTimeout) {
			clearTimeout(reloadTimeout)
		}

		console.log(`♻️ ${uri.fsPath} changed; scheduling reload...`)

		reloadTimeout = setTimeout(() => {
			console.log(`♻️ Reloading host after debounce delay...`)
			vscode.commands.executeCommand("workbench.action.reloadWindow")
		}, DEBOUNCE_DELAY)
	}

	watchPaths.forEach(({ p: watchPath, pattern }) => {
		const relPattern = new vscode.RelativePattern(vscode.Uri.file(watchPath), pattern)
		const watcher = vscode.workspace.createFileSystemWatcher(relPattern, false, false, false)

		watcher.onDidChange(debouncedReload)
		watcher.onDidCreate(debouncedReload)
		watcher.onDidDelete(debouncedReload)

		context.subscriptions.push(watcher)
	})

	context.subscriptions.push({
		dispose: () => {
			if (reloadTimeout) {
				clearTimeout(reloadTimeout)
			}
		},
	})
}

export async function buildApi(
	provider: EventBridge,
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
): Promise<JabberwockAPI> {
	const eventEmitter = new EventEmitter<JabberwockAPIEvents>()

	const api: JabberwockAPI = Object.assign(eventEmitter, {
		startNewTask: (opts: {
			configuration?: JabberwockSettings
			text?: string
			images?: string[]
			newTab?: boolean
		}) =>
			startNewTask(provider, context, outputChannel, {
				configuration: opts.configuration ?? ({} as JabberwockSettings),
				text: opts.text,
				images: opts.images,
				newTab: opts.newTab,
			}),

		resumeTask: async (taskId: string) => {
			const result = await getTaskWithId(taskId)
			const historyItem = result.historyItem

			if (historyItem) {
				await createTaskWithHistoryItem(provider, historyItem)
			}
		},
		isTaskInHistory: (taskId: string) => isTaskInHistory(provider, taskId),
		getCurrentTaskStack: () => getCurrentTaskStack(),
		popTaskFromStack: async (lastMessage?: string) => {
			await popTaskFromStack(lastMessage)
		},
		abortRunningTask: () => abortRunningTask(provider),
		sendMessage: (text?: string, images?: string[]) => sendMessage(provider, text, images),
		pressPrimaryButton: async () => {
			await provider.postMessageToWebview({ type: "invoke", invoke: "primaryButtonClick" })
		},
		pressSecondaryButton: async () => {
			await provider.postMessageToWebview({ type: "invoke", invoke: "secondaryButtonClick" })
		},
		healthcheck: () => healthcheck(),

		getConfiguration: () => getConfiguration(provider),
		setConfiguration: (values: JabberwockSettings) => setConfiguration(provider, values),

		getProfiles: () => {
			const state = getBackendRootStore() as {
				settings?: { apiConfig?: { listApiConfigMeta?: Array<{ name: string }> } }
			}
			return state.settings?.apiConfig?.listApiConfigMeta?.map((m) => m.name) ?? []
		},
		getProfileEntry: (name: string) => {
			const state = getBackendRootStore() as {
				settings?: {
					apiConfig?: {
						listApiConfigMeta?: Array<{ name: string; id: string; apiProvider?: string; modelId?: string }>
					}
				}
			}
			return state.settings?.apiConfig?.listApiConfigMeta?.find((m) => m.name === name) as
				| ProviderSettingsEntry
				| undefined
		},
		createProfile: (name: string, profile?: ProviderSettings, activate?: boolean) =>
			createProviderProfile(provider, name, profile as Record<string, unknown> | undefined, activate),
		updateProfile: (name: string, profile: ProviderSettings, activate?: boolean) =>
			updateProviderProfile(provider, name, profile as Record<string, unknown>, activate),
		upsertProfile: (name: string, profile: ProviderSettings, activate?: boolean) =>
			upsertProviderProfile(provider, name, profile as Record<string, unknown>, activate),
		deleteProfile: (name: string) => deleteProviderProfile(provider, { name }),
		getActiveProfile: () => {
			const state = getBackendRootStore() as { settings?: { apiConfig?: { currentConfigName?: string } } }
			return state.settings?.apiConfig?.currentConfigName
		},
		setActiveProfile: (name: string) => setActiveProfile(provider, name),
	})

	return api
}
