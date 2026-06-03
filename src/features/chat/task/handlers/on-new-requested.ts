import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../intents/bus"
import { resolveImageMentions } from "../messages/actions/resolveImageMentions"
import { createTask } from "../actions/startTask"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import * as vscode from "vscode"

/**
 * Handles task.new.requested intent — creates a new task.
 */
export function registerOnTaskNewRequested(bus: IntentBus): void {
	bus.register(IntentType.TaskNewRequested, async (intent, ctx) => {
		const provider = ctx.provider
		const payload = intent.payload as {
			text: string
			images?: string[]
			taskId?: string
			taskConfiguration?: unknown
		}

		if (!provider) {
			return
		}

		try {
			const currentCline = ctx.rootStore.chat.activeTask
			const cwd = currentCline?.cwd
			const text = payload.text ?? ""
			const images = payload.images
			const currentTask = ctx.rootStore.chat.activeTask

			const resolved = await resolveImageMentions({
				text,
				images,
				cwd: cwd ?? "",
				jabberwockIgnoreController: currentTask?.jabberwockIgnoreController,
			})

			const task = await createTask(
				provider,
				resolved.text,
				resolved.images,
				{ taskId: payload.taskId },
				payload.taskConfiguration,
			)

			await provider.postMessageToWebview({ type: "invoke", invoke: "newChat" })

			ctx.rootStore.chat.setIsRunning(true)

			if (task && task.messages) {
				await postStateToWebview(provider, {
					messages: task.messages,
					currentTaskItem: {
						id: task.taskId,
						ts: task.messages[0]?.ts ?? Date.now(),
						task: (task as { metadata?: { task?: string } }).metadata?.task ?? resolved.text,
					},
					isRunning: true,
				} as { [key: string]: unknown })
			}
		} catch (error: unknown) {
			await provider.postMessageToWebview({ type: "invoke", invoke: "newChat" })
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`[jabberwock] [${new Date().toISOString()}] Failed to create task: ${errorMessage}`)
			vscode.window.showErrorMessage(`Failed to create task: ${errorMessage}`)
			// Reset isRunning so the UI doesn't stay stuck in "running" state
			ctx.rootStore.chat.setIsRunning(false)
			// Rethrow so IntentBus.processQueue marks the intent as Failed
			throw error
		}
	})
}
