import * as path from "path"

import type { ITaskModel } from "@features/chat/task/store"
import { ApiMessage } from "./save/saveApiMessages.types"
import { cleanupAfterTruncation } from "@features/chat/task/condense/handlers/on-context-condense-history"
import { OutputInterceptor } from "@integrations/terminal/output-interceptor/OutputInterceptor"
import { getTaskDirectoryPath } from "@utils/io"
import { overwriteNotifications } from "@features/chat/task/notifications/actions"
import { overwriteApiConversationHistory } from "./save/saveApiMessages"

export interface RewindOptions {
	/** Whether to include the target message in deletion (edit=true, delete=false) */
	includeTargetMessage?: boolean
	/** Skip cleanup for special cases (default: false) */
	skipCleanup?: boolean
}

export interface ContextEventIds {
	condenseIds: Set<string>
	truncationIds: Set<string>
}

export function filterOutOrphanedSummaries(apiHistory: ApiMessage[], removedIds: ContextEventIds): ApiMessage[] {
	if (removedIds.condenseIds.size === 0) {
		return apiHistory
	}

	return apiHistory.filter((msg) => {
		if (msg.isSummary && msg.condenseId && removedIds.condenseIds.has(msg.condenseId)) {
			console.log(`[MessageManager] Removing orphaned Summary with condenseId: ${msg.condenseId}`)
			return false
		}
		return true
	})
}

export function filterOutOrphanedTruncationMarkers(
	apiHistory: ApiMessage[],
	removedIds: ContextEventIds,
): ApiMessage[] {
	if (removedIds.truncationIds.size === 0) {
		return apiHistory
	}

	return apiHistory.filter((msg) => {
		if (msg.isTruncationMarker && msg.truncationId && removedIds.truncationIds.has(msg.truncationId)) {
			console.log(`[MessageManager] Removing orphaned truncation marker with truncationId: ${msg.truncationId}`)
			return false
		}
		return true
	})
}

export function collectRemovedContextEventIds(task: ITaskModel, fromIndex: number): ContextEventIds {
	const condenseIds = new Set<string>()
	const truncationIds = new Set<string>()

	for (let i = fromIndex; i < task.messages.length; i++) {
		const msg = task.messages[i]

		if (msg.say === "condense_context" && msg.contextCondense?.condenseId) {
			condenseIds.add(msg.contextCondense.condenseId)
			console.log(`[MessageManager] Found condense_context to remove: ${msg.contextCondense.condenseId}`)
		}

		if (msg.say === "sliding_window_truncation" && msg.contextTruncation?.truncationId) {
			truncationIds.add(msg.contextTruncation.truncationId)
			console.log(
				`[MessageManager] Found sliding_window_truncation to remove: ${msg.contextTruncation.truncationId}`,
			)
		}
	}

	return { condenseIds, truncationIds }
}

export async function truncateClineMessages(taskId: string, messages: ITaskModel["messages"]): Promise<void> {
	await overwriteNotifications(taskId, messages)
}

function computeActualCutoff(apiHistory: ApiMessage[], cutoffTs: number): number {
	const hasExactMatch = apiHistory.some((m) => m.ts === cutoffTs)
	const hasMessageBeforeCutoff = apiHistory.some((m) => m.ts !== undefined && m.ts < cutoffTs)

	if (hasExactMatch || !hasMessageBeforeCutoff) {
		return cutoffTs
	}

	const firstUserMsgIndexToRemove = apiHistory.findIndex(
		(m) => m.ts !== undefined && m.ts >= cutoffTs && m.role === "user",
	)

	if (firstUserMsgIndexToRemove !== -1) {
		return apiHistory[firstUserMsgIndexToRemove].ts!
	}

	return cutoffTs
}

function collectValidArtifactIds(task: ITaskModel, apiHistory: ApiMessage[]): Set<string> {
	const validIds = new Set<string>()

	for (const msg of task.messages) {
		if (msg.ts) {
			validIds.add(String(msg.ts))
		}
	}

	for (const msg of apiHistory) {
		if (msg.ts) {
			validIds.add(String(msg.ts))
		}
	}

	return validIds
}

async function cleanupOrphanedArtifacts(task: ITaskModel, validIds: Set<string>): Promise<void> {
	try {
		const t = task as { globalStoragePath: string; taskId: string }
		const globalStoragePath = t.globalStoragePath
		const taskId = t.taskId

		if (!globalStoragePath || !taskId) {
			return
		}

		const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
		const outputDir = path.join(taskDir, "command-output")
		await OutputInterceptor.cleanupByIds(outputDir, validIds)
	} catch (error) {
		console.debug("[MessageManager] Artifact cleanup skipped:", error)
	}
}

export async function truncateApiHistoryWithCleanup(
	task: ITaskModel,
	cutoffTs: number,
	removedIds: ContextEventIds,
	skipCleanup: boolean,
): Promise<void> {
	const originalHistory = task.apiConversationHistory
	let apiHistory = [...originalHistory]

	const actualCutoff = computeActualCutoff(apiHistory, cutoffTs)

	apiHistory = apiHistory.filter((m) => !m.ts || m.ts < actualCutoff)

	apiHistory = filterOutOrphanedSummaries(apiHistory, removedIds)

	apiHistory = filterOutOrphanedTruncationMarkers(apiHistory, removedIds)

	if (!skipCleanup) {
		apiHistory = cleanupAfterTruncation(apiHistory)
	}

	if (!skipCleanup) {
		const validIds = collectValidArtifactIds(task, apiHistory)
		cleanupOrphanedArtifacts(task, validIds).catch((error: unknown) => {
			console.error("[jabberwock] [MessageManager] Error cleaning up orphaned command output artifacts:", error)
		})
	}

	const historyChanged =
		apiHistory.length !== originalHistory.length || apiHistory.some((msg, i) => msg !== originalHistory[i])

	if (historyChanged) {
		await overwriteApiConversationHistory(task, apiHistory)
	}
}
