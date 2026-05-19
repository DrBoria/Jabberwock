import { EventEmitter } from "events"
import * as vscode from "vscode"

import type {
	JabberwockAPI,
	JabberwockAPIEvents,
	JabberwockSettings,
	ProviderSettings,
	ProviderSettingsEntry,
} from "@jabberwock/types"

import type { EventBridge } from "../core/webview/EventBridge"
import { registerTaskLifecycleListeners } from "../features/chat/listeners"
import {
	startNewTask,
	resumeTask,
	isTaskInHistory,
	getCurrentTaskStack,
	clearCurrentTask,
	cancelCurrentTask,
	sendMessage,
	deleteQueuedMessage,
	pressPrimaryButton,
	pressSecondaryButton,
	isReady,
	getConfiguration,
	setConfiguration,
} from "../features/chat/api-methods"
import {
	createProviderProfile,
	updateProviderProfile,
	deleteProviderProfile,
	setActiveProfile,
	upsertProviderProfile,
} from "../features/settings/api-config/store"
import { getState } from "../features/storeSingleton"

export interface CreateJabberwockApiOptions {
	outputChannel: vscode.OutputChannel
	provider: EventBridge
	context: vscode.ExtensionContext
	emit: <K extends keyof JabberwockAPIEvents>(eventName: K, ...args: JabberwockAPIEvents[K]) => void
}

/**
 * Creates a JabberwockAPI-compatible object by composing feature store functions.
 * This replaces the old API class — each method delegates to its feature's store/listener module.
 */
export function createJabberwockApi(options: CreateJabberwockApiOptions): JabberwockAPI {
	const { outputChannel, provider, context } = options

	// Register task lifecycle listeners — task events are forwarded to IPC via options.emit
	registerTaskLifecycleListeners(provider, options.emit)

	// Create an EventEmitter for external subscription compatibility (JabberwockAPI extends EventEmitter)
	const eventEmitter = new EventEmitter<JabberwockAPIEvents>()

	const api: JabberwockAPI = Object.assign(eventEmitter, {
		// Task management
		startNewTask: (opts: {
			configuration: JabberwockSettings
			text?: string
			images?: string[]
			newTab?: boolean
		}) => startNewTask(provider, context, outputChannel, opts),

		resumeTask: (taskId: string) => resumeTask(provider, taskId),
		isTaskInHistory: (taskId: string) => isTaskInHistory(provider, taskId),
		getCurrentTaskStack: () => getCurrentTaskStack(provider),
		clearCurrentTask: (lastMessage?: string) => clearCurrentTask(provider, lastMessage),
		cancelCurrentTask: () => cancelCurrentTask(provider),
		sendMessage: (text?: string, images?: string[]) => sendMessage(provider, text, images),
		deleteQueuedMessage: (messageId: string) => deleteQueuedMessage(provider, messageId),
		pressPrimaryButton: () => pressPrimaryButton(provider),
		pressSecondaryButton: () => pressSecondaryButton(provider),
		isReady: () => isReady(provider),

		// Configuration management
		getConfiguration: () => getConfiguration(provider),
		setConfiguration: (values: JabberwockSettings) => setConfiguration(provider, values),

		// Profile management — read from MST store state (sync) to match JabberwockAPI interface
		getProfiles: () => {
			const state = getState(provider) as {
				settings?: { apiConfig?: { listApiConfigMeta?: Array<{ name: string }> } }
			}
			return state.settings?.apiConfig?.listApiConfigMeta?.map((m) => m.name) ?? []
		},
		getProfileEntry: (name: string) => {
			const state = getState(provider) as {
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
			const state = getState(provider) as { settings?: { apiConfig?: { currentConfigName?: string } } }
			return state.settings?.apiConfig?.currentConfigName
		},
		setActiveProfile: (name: string) => setActiveProfile(provider, name),
	})

	return api
}
