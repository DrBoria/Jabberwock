import * as vscode from "vscode"

import type { ApiReqData } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"
import { getApiMetrics } from "@shared/api/getApiMetrics"
import { t } from "@i18n"

import type { ITaskModel } from "@features/chat/task/store"
import { sendCancelTask } from "@features/chat/task/events/actions/sendTaskEvent"
import { sendCurrentCheckpointUpdated } from "@features/foundation/time-machine/events/actions/sendCheckpointEvent"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"
import { EventBridge } from "@features/foundation/webview/EventBridge"
import { getMstState } from "@features/foundation/mst/store"
import { getBackendRootStore } from "@features/storeSingleton"

import { getCheckpointService, showDiff } from "./checkpoints.helpers"
import { isModeWithCheckpoint, resolveDiffConfig } from "./checkpoints.helpers"
import type { CheckpointRestoreOptions, CheckpointDiffOptions } from "./checkpoints.types"

export type { CheckpointRestoreOptions, CheckpointDiffOptions }

export async function checkpointSave(task: ITaskModel, force = false, suppressMessage = false) {
	const service = await getCheckpointService(task)

	if (!service) {
		return
	}

	getTelemetryService().captureCheckpointCreated(task.taskId)

	return service
		.saveCheckpoint(`Task: ${task.taskId}, Time: ${Date.now()}`, { allowEmpty: force, suppressMessage })
		.catch((err: unknown) => {
			console.error("[jabberwock] [Task#checkpointSave] caught unexpected error, disabling checkpoints", err)
			task._state.setEnableCheckpoints(false)
		})
}

export async function checkpointRestore(
	task: ITaskModel,
	{ ts, commitHash, mode, operation = "delete" }: CheckpointRestoreOptions,
) {
	const service = await getCheckpointService(task)

	if (!service) {
		return
	}

	const index = task.messages.findIndex((m) => m.ts === ts)

	if (index === -1) {
		return
	}

	try {
		await service.restoreCheckpoint(commitHash)
		getTelemetryService().captureCheckpointRestored(task.taskId)
		sendCurrentCheckpointUpdated(commitHash)
		getMstState(getBackendRootStore()).checkpointStore?.setCurrentCheckpoint(commitHash)

		if (mode === "restore") {
			const deletedMessages = task.messages.slice(index + 1)

			const { totalTokensIn, totalTokensOut, totalCacheWrites, totalCacheReads, totalCost } = getApiMetrics(
				task.combineMessages!(deletedMessages),
			)

			await task.messageManager!.rewindToTimestamp(ts, {
				includeTargetMessage: operation === "edit",
			})

			await systemBroadcast(
				task.taskId,
				"api_req_deleted",
				JSON.stringify({
					tokensIn: totalTokensIn,
					tokensOut: totalTokensOut,
					cacheWrites: totalCacheWrites,
					cacheReads: totalCacheReads,
					cost: totalCost,
				} satisfies ApiReqData),
			)
		}

		sendCancelTask()
	} catch (err) {
		EventBridge.outputChannel?.appendLine("[checkpointRestore] disabling checkpoints for this task")
		task._state.setEnableCheckpoints(false)
	}
}

export async function checkpointDiff(
	task: ITaskModel,
	{ ts, previousCommitHash, commitHash, mode }: CheckpointDiffOptions,
) {
	const service = await getCheckpointService(task)

	if (!service) {
		return
	}

	getTelemetryService().captureCheckpointDiffed(task.taskId)

	const checkpoints = task.messages
		.filter(({ say }: { say?: string }) => say === "checkpoint_saved")
		.map(({ text }: { text?: string }) => text!)

	if (isModeWithCheckpoint(mode) && checkpoints.length < 1) {
		vscode.window.showInformationMessage(t("common:errors.checkpoint_no_first"))
		return
	}

	const diffConfig = resolveDiffConfig(mode, commitHash, checkpoints)

	if (!diffConfig.fromHash) {
		vscode.window.showInformationMessage(t("common:errors.checkpoint_no_previous"))
		return
	}

	try {
		await showDiff(service, diffConfig, checkpoints)
	} catch (err) {
		EventBridge.outputChannel?.appendLine("[checkpointDiff] disabling checkpoints for this task")
		task._state.setEnableCheckpoints(false)
	}
}
