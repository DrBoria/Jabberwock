import type { EventBridge } from "../../../core/webview/EventBridge"
import {
	historyItemSchema,
	type WebviewMessage,
	type ExtensionMessage,
	type ProviderSettings,
	type HistoryItem,
} from "@jabberwock/types"
import type { Task } from "../../chat/task/Task"
import { TelemetryService, getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"
import * as vscode from "vscode"
import { getCommand } from "../../../utils/commands"
import type { ExportContext } from "../../../utils/export"
import type { postMessageToWebview as PostMessageFn, postStateToWebview as PostStateFn } from "./store"

export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

export const handlerMap: Record<string, HandlerFn> = {
	focusPanelRequest: async (_provider, _message) => {
		await vscode.commands.executeCommand(getCommand("focusPanel"))
	},

	switchTab: async (provider, message) => {
		if (message.tab) {
			if (hasTelemetryService() && !message.fromMCP) {
				getTelemetryService().captureTabShown(message.tab)
			}

			const { postMessageToWebview } = await import("./store")
			await postMessageToWebview(provider, {
				type: "action",
				action: "switchTab",
				tab: message.tab,
				values: message.values,
				fromMCP: message.fromMCP === true,
			})
		}
	},

	activePageResponse: async (provider, message) => {
		if (message.requestId && message.activePage) {
			const { resolveActivePageRequest } = await import("../../../features/foundation/window-manager/store")
			resolveActivePageRequest(provider, message.requestId, message.activePage)
		}
	},

	getTaskWithAggregatedCosts: async (provider, message) => {
		try {
			const taskId = message.text
			if (!taskId) {
				throw new Error("Task ID is required")
			}
			const { getTaskWithId } = await import("../../history/store")
			const { aggregateTaskCostsRecursive } = await import("../../chat/task/utils/aggregateTaskCosts")
			const { historyItem } = await getTaskWithId(provider, taskId)
			const getTaskHistory = async (id: string) => {
				const result = await getTaskWithId(provider, id)
				return result.historyItem
			}
			const aggregatedCosts = await aggregateTaskCostsRecursive(taskId, getTaskHistory)
			const { postMessageToWebview } = await import("./store")
			await postMessageToWebview(provider, {
				type: "taskWithAggregatedCosts",
				text: taskId,
				historyItem,
				aggregatedCosts,
			})
		} catch (error) {
			console.error("Error getting task with aggregated costs:", error)
			const { postMessageToWebview } = await import("./store")
			await postMessageToWebview(provider, {
				type: "taskWithAggregatedCosts",
				text: message.text,
				error: error instanceof Error ? error.message : String(error),
			})
		}
	},

	showTaskWithId: async (provider, message) => {
		const id = message.text!
		const currentTask = provider.getCurrentTask()
		let parentTaskId: string | undefined

		if (id !== currentTask?.taskId) {
			const { getTaskWithId } = await import("../../history/store")
			const { createTaskWithHistoryItem } = await import("../../chat/task/actions/startTask")
			const { historyItem } = await getTaskWithId(provider, id)
			parentTaskId = historyItem?.parentTaskId

			if (currentTask) {
				// Resume the existing task from history
				await createTaskWithHistoryItem(provider, historyItem)
			} else if (historyItem) {
				// No active task — create a brand-new Task from the history item.
				// Parse the MST snapshot through the Zod schema to get a properly-typed
				// HistoryItem, avoiding unsafe casts between HistoryTaskItem and HistoryItem.
				const { Task } = await import("../../chat/task/Task")
				const state = await provider.getState()
				const newTask = new Task({
					provider,
					apiConfiguration: state.apiConfiguration as ProviderSettings,
					historyItem: historyItemSchema.parse(historyItem),
				})
				await provider.addClineToStack(newTask)

				// Push task state to the webview so it transitions from HomeScreen to
				// ChatArea. The newTask handler does the same — this branch was missing it,
				// causing the "New Task" button to appear instead of the active chat.
				const { postStateToWebview } = await import("./store")
				await postStateToWebview(provider, {
					clineMessages: newTask.clineMessages,
					currentTaskItem: {
						id: newTask.taskId,
						ts: newTask.clineMessages[0]?.ts ?? Date.now(),
						task: newTask.metadata?.task ?? historyItem.task ?? "",
					},
				} as Record<string, unknown>)
			}
		} else {
			parentTaskId = currentTask?.parentTaskId
		}

		if (parentTaskId) {
			await provider.postMessageToWebview({
				type: "action",
				action: "switchTab",
				tab: "chat",
				values: { parentTaskId },
			})
		} else {
			await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		}
	},

	deleteTaskWithId: async (provider, message) => {
		const id = message.text!
		if (!id) return

		const { getTaskWithId, deleteTaskFromState } = await import("../../history/store")

		// Recursively collect all child IDs
		const collectChildIds = async (taskId: string): Promise<string[]> => {
			const ids: string[] = [taskId]
			const { historyItem } = await getTaskWithId(provider, taskId)
			if (historyItem?.childIds) {
				for (const childId of historyItem.childIds) {
					const childIds = await collectChildIds(childId)
					ids.push(...childIds)
				}
			}
			return ids
		}

		const allIdsToDelete = await collectChildIds(id)

		// Delete from state
		for (const deleteId of allIdsToDelete) {
			await deleteTaskFromState(provider, deleteId)
		}

		// If it's the current task, remove from stack
		if (provider.getCurrentTask()?.taskId === id) {
			provider.getCurrentTask()?.abortTask?.()
			const idx = provider.taskStack.findIndex((t) => t.taskId === id)
			if (idx !== -1) {
				provider.taskStack.splice(idx, 1)
			}
		}

		const { postStateToWebview } = await import("./store")
		await postStateToWebview(provider)
	},

	exportTaskWithId: async (provider, message) => {
		const id = message.text!
		const { getTaskWithId } = await import("../../history/store")
		const { historyItem } = await getTaskWithId(provider, id)

		if (historyItem) {
			const { downloadTask, getTaskFileName } = await import("../../../integrations/misc/export-markdown")
			const { resolveDefaultSaveUri, saveLastExportPath } = await import("../../../utils/export")
			const os = await import("os")

			const fileName = getTaskFileName(historyItem.ts)
			const defaultUri = resolveDefaultSaveUri(
				provider.contextProxy as ExportContext,
				"lastTaskExportPath",
				fileName,
				{ useWorkspace: false, fallbackDir: os.homedir() + "/Downloads" },
			)
			const saveUri = await downloadTask(historyItem.ts, [], defaultUri)
			if (saveUri) {
				await saveLastExportPath(provider.contextProxy as ExportContext, "lastTaskExportPath", saveUri)
			}
		}
	},

	exportCurrentTask: async (provider, _message) => {
		const currentTaskId = provider.getCurrentTask()?.taskId
		if (currentTaskId) {
			const { getTaskWithId } = await import("../../history/store")
			const { historyItem } = await getTaskWithId(provider, currentTaskId)

			if (historyItem) {
				const { downloadTask, getTaskFileName } = await import("../../../integrations/misc/export-markdown")
				const { resolveDefaultSaveUri, saveLastExportPath } = await import("../../../utils/export")
				const os = await import("os")

				const fileName = getTaskFileName(historyItem.ts)
				const defaultUri = resolveDefaultSaveUri(
					provider.contextProxy as ExportContext,
					"lastTaskExportPath",
					fileName,
					{ useWorkspace: false, fallbackDir: os.homedir() + "/Downloads" },
				)
				const saveUri = await downloadTask(historyItem.ts, [], defaultUri)
				if (saveUri) {
					await saveLastExportPath(provider.contextProxy as ExportContext, "lastTaskExportPath", saveUri)
				}
			}
		}
	},

	deleteMultipleTasksWithIds: async (provider, message) => {
		const ids = message.ids

		if (Array.isArray(ids)) {
			const batchSize = 20
			const results = []

			console.log(`Batch deletion started: ${ids.length} tasks total`)

			const { getTaskWithId, deleteTaskFromState } = await import("../../history/store")

			for (let i = 0; i < ids.length; i += batchSize) {
				const batch = ids.slice(i, i + batchSize)

				const batchPromises = batch.map(async (id: string) => {
					try {
						// Recursively collect all child IDs
						const collectChildIds = async (taskId: string): Promise<string[]> => {
							const ids: string[] = [taskId]
							const { historyItem } = await getTaskWithId(provider, taskId)
							if (historyItem?.childIds) {
								for (const childId of historyItem.childIds) {
									const childIds = await collectChildIds(childId)
									ids.push(...childIds)
								}
							}
							return ids
						}

						const allIdsToDelete = await collectChildIds(id)

						// Delete from state
						for (const deleteId of allIdsToDelete) {
							await deleteTaskFromState(provider, deleteId)
						}

						return { id, success: true }
					} catch (error) {
						console.log(
							`Failed to delete task ${id}: ${error instanceof Error ? error.message : String(error)}`,
						)
						return { id, success: false }
					}
				})

				const batchResults = await Promise.all(batchPromises)
				results.push(...batchResults)

				const { postStateToWebview } = await import("./store")
				await postStateToWebview(provider)
			}

			const successCount = results.filter((r) => r.success).length
			const failCount = results.length - successCount
			console.log(
				`Batch deletion completed: ${successCount}/${ids.length} tasks successful, ${failCount} tasks failed`,
			)
		}
	},
}
