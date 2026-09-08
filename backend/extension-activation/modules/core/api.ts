import * as vscode from "vscode"
import * as path from "path"
import { EventEmitter } from "events"
import { when } from "mobx"

import type {
	JabberwockAPI,
	JabberwockAPIEvents,
	JabberwockSettings,
	ProviderSettings,
	ProviderSettingsEntry,
} from "@jabberwock/types"

import { EventBridge } from "@features/foundation/webview/EventBridge"
import { getBackendRootStore } from "@features/storeSingleton"
import {
	dispatchTaskCancelIntent,
	dispatchTaskNewIntent,
	dispatchTaskResumeIntent,
} from "@features/api/events/actions/task-command-intents"
import { startNewTask } from "@features/chat/task/actions/startTask"
import { isTaskInHistory, getCurrentTaskStack } from "@features/chat/task/actions/taskRegistry"
import { popTaskFromStack } from "@features/chat/task/actions/abortRunningTask"
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

/** Resolves with the key of a task added to chat.tasks after `knownKeys` were captured; rejects if none appears within 15 seconds. */
function waitForNewTaskId(
	store: NonNullable<ReturnType<typeof getBackendRootStore>>,
	knownKeys: ReadonlySet<string>,
): Promise<string> {
	return new Promise((resolve, reject) => {
		when(() => [...store.chat.tasks.keys()].some((key) => !knownKeys.has(key)), { timeout: 15_000 }).then(
			() => {
				const key = [...store.chat.tasks.keys()].find((k) => !knownKeys.has(k))
				if (key !== undefined) {
					resolve(key)
				} else {
					reject(new Error("startNewTask timed out waiting for the task to appear in chat.tasks"))
				}
			},
			(error: unknown) => {
				reject(error instanceof Error ? error : new Error(String(error)))
			},
		)
	})
}

export async function buildApi(provider: EventBridge): Promise<JabberwockAPI> {
	const eventEmitter = new EventEmitter<JabberwockAPIEvents>()

	const api: JabberwockAPI = Object.assign(eventEmitter, {
		startNewTask: async ({
			configuration,
			text,
			images,
			newTab,
		}: {
			configuration?: JabberwockSettings
			text?: string
			images?: string[]
			newTab?: boolean
		}) => {
			if (newTab || configuration !== undefined) {
				// D4g-2 (batch 4): startNewTask is host-neutral — the new-tab provider and host
				// commands are resolved through the capability slots inside the action.
				return startNewTask(provider, {
					configuration: configuration ?? ({} as JabberwockSettings),
					text,
					images,
					newTab,
				})
			}

			const store = getBackendRootStore()
			if (!store) throw new Error("startNewTask failed: backend root store is not initialized")

			// Legacy parity with the direct startNewTask action (start-new-task.ts L35-41): a new task replaces any active one.
			const activeTask = store.chat.activeTask
			if (activeTask) {
				store.chat.clearAllStreamingToolCalls()
				store.chat.removeTask(activeTask.taskId)
			}

			const knownKeys = new Set(store.chat.tasks.keys())
			dispatchTaskNewIntent({ text, images })
			return waitForNewTaskId(store, knownKeys)
		},

		resumeTask: async (taskId: string) => {
			// Preserve the documented @throws contract for unknown task ids; completion then happens asynchronously in the IntentBus fiber, same as WS/IPC transports.
			await getTaskWithId(taskId)

			dispatchTaskResumeIntent(taskId)
		},
		isTaskInHistory: (taskId: string) => isTaskInHistory(provider, taskId),
		getCurrentTaskStack: () => getCurrentTaskStack(),
		popTaskFromStack: async (lastMessage?: string) => {
			await popTaskFromStack(lastMessage)
		},
		// v4 Phase C3 (plan row C3): cancel routes through the shared Critical-bucket intent, same as WS/IPC transports.
		abortRunningTask: async () => {
			const store = getBackendRootStore()
			if (!store) return

			dispatchTaskCancelIntent()
			await when(() => !store.chat.isRunning || !store.chat.activeTask, { timeout: 15_000 }).catch(
				(error: unknown) => {
					console.warn(
						`[jabberwock] [buildApi] abortRunningTask timed out waiting for cancel to take effect: ${String(error)}`,
					)
				},
			)
		},
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
