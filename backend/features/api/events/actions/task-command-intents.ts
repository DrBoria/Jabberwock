/**
 * v4 Phase C3 (plan row C3; section 10.2 buildApi line) / v3 B7 completion - task command surface as intent action creators.
 *
 * These are the single source of truth for turning a TaskCommandName command (packages/types/src/api/ipc.ts)
 * into an IntentBus dispatch. Every transport that exposes the command surface calls these same creators:
 *   - WebSocket server mode: ordinary WebviewMessage bodies ("newTask" / "cancelTask" / "resumeTask" /
 *     "sendMessage") routed by onWebviewMessage registrations (register-on-task-intents.ts) - plan row C3.
 *   - IpcServer unix socket for CLI/evals (extension-activation/modules/services/ipc.ts).
 *   - JabberwockAPI returned from extension activation (buildApi in modules/core/api.ts).
 *
 * Creators are transport-agnostic and vscode-free: they only touch the backend root store's IntentStore, so the
 * same code path runs inside the VS Code host process and over the network. Priority semantics live with the
 * intent types themselves (section 5.1): task.cancel.requested is a Critical-bucket intent that preempts streaming
 * fibers at yield points (decision D-9).
 */

import { IntentStatus, IntentType } from "@jabberwock/types"
import type { JabberwockSettings } from "@jabberwock/types"
import { getBackendRootStore } from "@features/storeSingleton"

/** Dispatch TaskNewRequested - the intent behind TaskCommandName.StartNewTask and WebviewMessage "newTask". */
export function dispatchTaskNewIntent(options: {
	text?: string
	images?: string[]
	taskConfiguration?: JabberwockSettings | Record<string, unknown>
}): void {
	const store = getBackendRootStore()
	if (!store) return

	store.intentStore.createIntent({
		id: crypto.randomUUID(),
		type: IntentType.TaskNewRequested,
		payload: {
			text: options.text ?? "",
			images: options.images ?? undefined,
			taskConfiguration: (options.taskConfiguration as Record<string, unknown> | undefined) ?? undefined,
		},
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})
}

/** Dispatch TaskCancelRequested - the intent behind TaskCommandName.CancelTask and WebviewMessage "cancelTask". */
export function dispatchTaskCancelIntent(): void {
	const store = getBackendRootStore()
	if (!store) return

	store.intentStore.createIntent({
		id: crypto.randomUUID(),
		type: IntentType.TaskCancelRequested,
		payload: {},
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})
}

/** Dispatch TaskResumeRequested - the intent behind TaskCommandName.ResumeTask and WebviewMessage "resumeTask". */
export function dispatchTaskResumeIntent(taskId: string): void {
	const store = getBackendRootStore()
	if (!store) return

	store.intentStore.createIntent({
		id: crypto.randomUUID(),
		type: IntentType.TaskResumeRequested,
		payload: { taskId },
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})
}

/**
 * Dispatch SendMessageToAgentRequested - the intent behind TaskCommandName.SendMessage and WebviewMessage "sendMessage".
 * Without an explicit taskId the prompt targets the active task, mirroring IpcServer behavior.
 * @returns true when a target task existed and the intent was queued; false otherwise (no-op).
 */
export function dispatchSendMessageToAgent(prompt: string, taskId?: string): boolean {
	const store = getBackendRootStore()
	if (!store) return false

	const resolvedTaskId = taskId ?? store.chat.activeTask?.taskId
	if (!resolvedTaskId) return false

	store.intentStore.createIntent({
		id: crypto.randomUUID(),
		type: IntentType.SendMessageToAgentRequested,
		payload: { taskId: resolvedTaskId, prompt },
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})
	return true
}
