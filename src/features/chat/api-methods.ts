import * as vscode from "vscode"
import pWaitFor from "p-wait-for"

import {
	type JabberwockSettings,
	type CreateTaskOptions,
	type TaskEvent,
	JabberwockEventName,
	TaskCommandName,
	IpcOrigin,
	IpcMessageType,
	isSecretStateKey,
} from "@jabberwock/types"

import { Package } from "../../shared/package"
import type { EventBridge, CurrentTask } from "../../core/webview/EventBridge"
import { openClineInNewTab } from "../../activate/registerCommands"
import { createTaskWithHistoryItem, createTask } from "./task/actions/startTask"

// Lazy imports to avoid circular dependency at module load time
export function lazyPostStateToWebview() {
	return require("../foundation/window-manager/store") as {
		postStateToWebview: (provider: EventBridge, additionalState?: Record<string, unknown>) => Promise<void>
	}
}

function lazyGetTaskWithId() {
	return require("../history/store") as {
		getTaskWithId: (
			provider: EventBridge,
			taskId: string,
		) => Promise<{ historyItem: Record<string, unknown> | null }>
	}
}

function lazyGetState(provider: EventBridge) {
	const storeModule = require("../store") as { getState: (p: EventBridge) => Record<string, unknown> }
	return storeModule.getState(provider) as Record<string, unknown>
}

/**
 * Starts a new task.
 */
export async function startNewTask(
	provider: EventBridge,
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
	options: {
		configuration: JabberwockSettings
		text?: string
		images?: string[]
		newTab?: boolean
	},
): Promise<string> {
	const { configuration, text, images, newTab } = options
	let targetProvider: EventBridge

	if (newTab) {
		await vscode.commands.executeCommand("workbench.action.files.revert")
		await vscode.commands.executeCommand("workbench.action.closeAllEditors")

		targetProvider = await openClineInNewTab({ context, outputChannel })
	} else {
		await vscode.commands.executeCommand(`${Package.name}.SidebarProvider.focus`)
		targetProvider = provider
	}

	// Pop any stale tasks from the stack
	const taskStack: CurrentTask[] = targetProvider.taskStack ?? []
	taskStack.pop()
	await lazyPostStateToWebview().postStateToWebview(targetProvider)
	await targetProvider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
	await targetProvider.postMessageToWebview({ type: "invoke", invoke: "newChat", text, images })

	const taskOptions: CreateTaskOptions = {
		consecutiveMistakeLimit: Number.MAX_SAFE_INTEGER,
	}

	const task = await createTask(targetProvider, text, images, configuration ?? taskOptions, undefined)

	if (!task) {
		throw new Error("Failed to create task due to policy restrictions")
	}

	return task.taskId
}

/**
 * Resumes a task with the given ID.
 */
export async function resumeTask(provider: EventBridge, taskId: string): Promise<void> {
	await vscode.commands.executeCommand(`${Package.name}.SidebarProvider.focus`)
	await waitForWebviewLaunch(provider, 5_000)

	const { historyItem } = await lazyGetTaskWithId().getTaskWithId(provider, taskId)
	await createTaskWithHistoryItem(provider, historyItem)

	if (getViewLaunched(provider)) {
		await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
	}
}

/**
 * Checks if a task is in the task history.
 */
export async function isTaskInHistory(provider: EventBridge, taskId: string): Promise<boolean> {
	try {
		await lazyGetTaskWithId().getTaskWithId(provider, taskId)
		return true
	} catch {
		return false
	}
}

/**
 * Returns the current task stack (array of task IDs).
 */
export function getCurrentTaskStack(provider: EventBridge): string[] {
	return (provider.taskStack ?? []).map((t: CurrentTask) => t.taskId)
}

/**
 * Clears the current task.
 */
export async function clearCurrentTask(provider: EventBridge, _lastMessage?: string): Promise<void> {
	provider.taskStack?.pop()
	await lazyPostStateToWebview().postStateToWebview(provider)
}

/**
 * Cancels the current task.
 */
export async function cancelCurrentTask(provider: EventBridge): Promise<void> {
	const currentTask = provider.taskStack?.[0]
	if (currentTask?.abort) {
		currentTask.abortTask()
	}
}

/**
 * Sends a message to the current task.
 */
export async function sendMessage(provider: EventBridge, text?: string, images?: string[]): Promise<void> {
	const currentTask = provider.taskStack?.[0]

	// In headless/sandbox flows the webview may not be launched
	if (!getViewLaunched(provider)) {
		if (!currentTask) {
			return
		}

		await currentTask.submitUserMessage(text ?? "", images)
		return
	}

	await provider.postMessageToWebview({ type: "invoke", invoke: "sendMessage", text, images })
}

/**
 * Deletes a queued message by ID.
 */
export function deleteQueuedMessage(provider: EventBridge, messageId: string): void {
	const currentTask = provider.taskStack?.[0]
	if (!currentTask) {
		return
	}

	currentTask.messageQueueService.removeMessage(messageId)
}

/**
 * Simulates pressing the primary button.
 */
export async function pressPrimaryButton(provider: EventBridge): Promise<void> {
	await provider.postMessageToWebview({ type: "invoke", invoke: "primaryButtonClick" })
}

/**
 * Simulates pressing the secondary button.
 */
export async function pressSecondaryButton(provider: EventBridge): Promise<void> {
	await provider.postMessageToWebview({ type: "invoke", invoke: "secondaryButtonClick" })
}

/**
 * Returns whether the webview is launched and ready.
 */
export function isReady(provider: EventBridge): boolean {
	return getViewLaunched(provider)
}

/**
 * Gets the current configuration (minus secrets).
 */
export function getConfiguration(provider: EventBridge): JabberwockSettings {
	return Object.fromEntries(
		Object.entries(provider.getValues()).filter(([key]) => !isSecretStateKey(key)),
	) as JabberwockSettings
}

/**
 * Sets the configuration for the current API profile.
 */
export async function setConfiguration(provider: EventBridge, values: JabberwockSettings): Promise<void> {
	await provider.contextProxy.setValues(values)
	await provider.providerSettingsManager?.saveConfig(values.currentApiConfigName || "default", values)
	await lazyPostStateToWebview().postStateToWebview(provider)
}

// Internal helpers

function getViewLaunched(provider: EventBridge): boolean {
	const state = lazyGetState(provider) as Record<string, unknown>
	const foundation = state.foundation as Record<string, unknown> | undefined
	if (!foundation) {
		return false
	}
	const windowManager = foundation.windowManager as Record<string, unknown> | undefined
	return !!windowManager?.viewLaunched
}

async function waitForWebviewLaunch(provider: EventBridge, timeoutMs: number): Promise<boolean> {
	try {
		await pWaitFor(() => getViewLaunched(provider), {
			timeout: timeoutMs,
			interval: 50,
		})
		return true
	} catch {
		return false
	}
}
