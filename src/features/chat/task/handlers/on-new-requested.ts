import { getSnapshot } from "mobx-state-tree"
import { IntentType } from "@jabberwock/types"
import type { Goal, Notification } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { resolveImageMentions } from "@features/chat/task/messages/actions/mentions/resolveImageMentions"
import { createTask } from "@features/chat/task/actions/startTask"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import * as vscode from "vscode"

/**
 * Handles task.new.requested intent — creates a new task.
 */
export function registerOnTaskNewRequested(bus: IntentBus): void {
	bus.register(IntentType.TaskNewRequested, async (intent, ctx) => {
		const provider = ctx.provider

		if (!provider) {
			return
		}

		const payload = intent.payload as {
			text: string
			images?: string[]
			taskId?: string
			taskConfiguration?: unknown
			goals?: Goal[]
		}

		handleNewTaskIntent(provider as never, ctx as never, payload).catch((error: unknown) => {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`[jabberwock] [${new Date().toISOString()}] Failed to create task: ${errorMessage}`)
			vscode.window.showErrorMessage(`Failed to create task: ${errorMessage}`)
			ctx.rootStore.chat.setIsRunning(false)
			throw error
		})
	})
}

async function handleNewTaskIntent(
	provider: { postMessageToWebview: (msg: unknown) => Promise<void> },
	ctx: {
		rootStore: {
			chat: {
				activeTask: { cwd?: string; jabberwockIgnoreController?: string } | null
				setIsRunning: (v: boolean) => void
			}
		}
	},
	payload: {
		text: string
		images?: string[]
		taskId?: string
		taskConfiguration?: unknown
		goals?: Goal[]
		mode?: string
	},
): Promise<void> {
	const activeTask = ctx.rootStore.chat.activeTask
	const cwd = activeTask?.cwd
	const text = payload.text ?? ""

	const resolved = await resolveImageMentions({
		text,
		images: payload.images,
		cwd: cwd ?? "",
		jabberwockIgnoreController: activeTask?.jabberwockIgnoreController,
	})

	const task = await createTask(
		provider as never,
		resolved.text,
		resolved.images,
		undefined,
		payload.taskConfiguration,
		payload.goals,
		payload.mode,
	)

	ctx.rootStore.chat.setIsRunning(true)

	if (task) {
		const messages = getSnapshot(task.notifications.items) as Notification[]
		await postTaskCreatedState(provider, messages, task as never, resolved.text)
	}
}

async function postTaskCreatedState(
	provider: { postMessageToWebview: (msg: unknown) => Promise<void> },
	messages: Notification[],
	task: {
		taskId: string
		goals?: Goal[]
		goalsHistory?: Goal[]
		metadata?: { task?: string }
	},
	resolvedText: string,
): Promise<void> {
	const goals = task.goals ?? []
	const goalsHistory = task.goalsHistory ?? []
	console.log(
		`[on-new-requested] posting state to webview: taskId=${task.taskId}, goals count=${goals.length}, messages count=${messages.length}, goals:`,
		JSON.stringify(goals.map((g: Goal) => g.text)),
	)
	await postStateToWebview(
		provider as never,
		{
			messages,
			currentTaskItem: {
				id: task.taskId,
				ts: messages[0]?.ts ?? Date.now(),
				task: task.metadata?.task ?? resolvedText,
				goals,
				goalsHistory,
			},
			isRunning: true,
		} as { [key: string]: unknown },
	)
}
