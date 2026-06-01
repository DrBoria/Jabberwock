import pWaitFor from "p-wait-for"
import * as vscode from "vscode"

import type { ApiReqData, ExtensionMessage } from "@jabberwock/types"
import { TelemetryService, getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"
import { getMstState } from "../../../foundation/mst/store"
import { getBackendRootStore } from "@features/storeSingleton"

import type { ITaskModel } from "../../../chat/task/store"

import { getWorkspacePath } from "../../../../utils/path"
import { checkGitInstalled } from "../../../../utils/git"
import { t } from "../../../../i18n"

import { getApiMetrics } from "../../../../shared/getApiMetrics"

import { DIFF_VIEW_URI_SCHEME_JABBERWOCK } from "../../../../integrations/editor/DiffViewProvider"

import { CheckpointServiceOptions, RepoPerTaskCheckpointService } from "../../../../services/checkpoints"

const WARNING_THRESHOLD_MS = 5000

function sendCheckpointInitWarn(task: ITaskModel, type?: "WAIT_TIMEOUT" | "INIT_TIMEOUT", timeout?: number) {
	task.providerRef!.deref()?.postMessageToWebview({
		type: "checkpointInitWarning",
		checkpointWarning: type && timeout ? { type, timeout } : undefined,
	})
}

export async function getCheckpointService(task: ITaskModel, { interval = 250 }: { interval?: number } = {}) {
	if (!task._state.enableCheckpoints) {
		return undefined
	}

	if (task.checkpointService) {
		return task.checkpointService
	}

	const provider = task.providerRef!.deref()

	// Get checkpoint timeout from task settings (converted to milliseconds)
	const checkpointTimeoutMs = task._state.checkpointTimeout * 1000

	const log = (message: string) => {
		try {
			EventBridge.outputChannel?.appendLine(message)
		} catch (err) {
			// NO-OP
		}
	}

	try {
		const workspaceDir = task.cwd || getWorkspacePath()

		if (!workspaceDir) {
			log("[Task#getCheckpointService] workspace folder not found, disabling checkpoints")
			task._state.setEnableCheckpoints(false)
			return undefined
		}

		const globalStorageDir = provider?.context.globalStorageUri.fsPath

		if (!globalStorageDir) {
			log("[Task#getCheckpointService] globalStorageDir not found, disabling checkpoints")
			task._state.setEnableCheckpoints(false)
			return undefined
		}

		const options: CheckpointServiceOptions = {
			taskId: task.taskId,
			workspaceDir,
			shadowDir: globalStorageDir,
			log,
		}

		if (task._state.checkpointServiceInitializing) {
			const checkpointInitStartTime = Date.now()
			let warningShown = false

			await pWaitFor(
				() => {
					const elapsed = Date.now() - checkpointInitStartTime

					// Show warning if we're past the threshold and haven't shown it yet
					if (!warningShown && elapsed >= WARNING_THRESHOLD_MS) {
						warningShown = true
						sendCheckpointInitWarn(task, "WAIT_TIMEOUT", WARNING_THRESHOLD_MS / 1000)
					}

					console.log(
						`[Task#getCheckpointService] waiting for service to initialize (${Math.round(elapsed / 1000)}s)`,
					)
					return !!task.checkpointService && !!task.checkpointService?.isInitialized
				},
				{ interval, timeout: checkpointTimeoutMs },
			)
			if (!task.checkpointService) {
				sendCheckpointInitWarn(task, "INIT_TIMEOUT", task._state.checkpointTimeout)
				task._state.setEnableCheckpoints(false)
				return undefined
			} else {
				sendCheckpointInitWarn(task)
			}
			return task.checkpointService
		}

		if (!task._state.enableCheckpoints) {
			return undefined
		}

		const service = RepoPerTaskCheckpointService.create(options)
		task._state.setCheckpointServiceInitializing(true)
		await checkGitInstallation(task, service, log, provider)
		// Set checkpoint service on task instance
		task.checkpointService = service
		if (task._state.enableCheckpoints) {
			sendCheckpointInitWarn(task)
		}
		return service
	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err))
		if (error.name === "TimeoutError" && task._state.enableCheckpoints) {
			sendCheckpointInitWarn(task, "INIT_TIMEOUT", task._state.checkpointTimeout)
		}
		log(`[Task#getCheckpointService] ${error.message}`)
		task._state.setEnableCheckpoints(false)
		task._state.setCheckpointServiceInitializing(false)
		return undefined
	}
}

import { EventBridge } from "../../webview/EventBridge"
import { systemBroadcast } from "../../../chat/task/messages/actions/say"

async function checkGitInstallation(
	task: ITaskModel,
	service: RepoPerTaskCheckpointService,
	log: (message: string) => void,
	provider: EventBridge,
) {
	try {
		const gitInstalled = await checkGitInstalled()

		if (!gitInstalled) {
			log("[Task#getCheckpointService] Git is not installed, disabling checkpoints")
			task._state.setEnableCheckpoints(false)
			task._state.setCheckpointServiceInitializing(false)

			// Show user-friendly notification
			const selection = await vscode.window.showWarningMessage(
				t("common:errors.git_not_installed"),
				t("common:buttons.learn_more"),
			)

			if (selection === t("common:buttons.learn_more")) {
				await vscode.env.openExternal(vscode.Uri.parse("https://git-scm.com/downloads"))
			}

			return
		}

		// Git is installed, proceed with initialization
		service.on("initialize", () => {
			// log("[Task#getCheckpointService] service initialized")
			task._state.setCheckpointServiceInitializing(false)
		})

		service.on("checkpoint", ({ fromHash: from, toHash: to, suppressMessage }) => {
			try {
				sendCheckpointInitWarn(task)
				// Always update the current checkpoint hash in the webview, including the suppress flag
				provider?.postMessageToWebview({
					type: "currentCheckpointUpdated",
					text: to,
					suppressMessage: !!suppressMessage,
				})
				if (provider) {
					getMstState(getBackendRootStore()).checkpointStore?.setCurrentCheckpoint(to)
				}

				// Always create the chat message but include the suppress flag in the payload
				// so the chatview can choose not to render it while keeping it in history.
				systemBroadcast(
					task.taskId,
					"checkpoint_saved",
					to,
					undefined,
					undefined,
					{ from, to, suppressMessage: !!suppressMessage },
					undefined,
					{ isNonInteractive: true },
				).catch((err: unknown) => {
					log("[Task#getCheckpointService] caught unexpected error in say('checkpoint_saved')")
					console.error(`[jabberwock]`, err)
				})
			} catch (err) {
				log("[Task#getCheckpointService] caught unexpected error in on('checkpoint'), disabling checkpoints")
				console.error(`[jabberwock]`, err)
				task._state.setEnableCheckpoints(false)
			}
		})

		try {
			await service.initShadowGit()
		} catch (err) {
			log(`[Task#getCheckpointService] initShadowGit -> ${err instanceof Error ? err.message : String(err)}`)
			task._state.setEnableCheckpoints(false)
		}
	} catch (err) {
		log(
			`[Task#getCheckpointService] Unexpected error during Git check: ${err instanceof Error ? err.message : String(err)}`,
		)
		console.error("[jabberwock] Git check error:", err)
		task._state.setEnableCheckpoints(false)
		task._state.setCheckpointServiceInitializing(false)
	}
}

export async function checkpointSave(task: ITaskModel, force = false, suppressMessage = false) {
	const service = await getCheckpointService(task)

	if (!service) {
		return
	}

	getTelemetryService().captureCheckpointCreated(task.taskId)

	// Start the checkpoint process in the background.
	return service
		.saveCheckpoint(`Task: ${task.taskId}, Time: ${Date.now()}`, { allowEmpty: force, suppressMessage })
		.catch((err: unknown) => {
			console.error("[jabberwock] [Task#checkpointSave] caught unexpected error, disabling checkpoints", err)
			task._state.setEnableCheckpoints(false)
		})
}

export type CheckpointRestoreOptions = {
	ts: number
	commitHash: string
	mode: "preview" | "restore"
	operation?: "delete" | "edit" // Optional to maintain backward compatibility
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

	const provider = task.providerRef!.deref()

	try {
		await service.restoreCheckpoint(commitHash)
		getTelemetryService().captureCheckpointRestored(task.taskId)
		await provider?.postMessageToWebview({ type: "currentCheckpointUpdated", text: commitHash })
		if (provider) {
			getMstState(getBackendRootStore()).checkpointStore?.setCurrentCheckpoint(commitHash)
		}

		if (mode === "restore") {
			// Calculate metrics from messages that will be deleted (must be done before rewind)
			const deletedMessages = task.messages.slice(index + 1)

			const { totalTokensIn, totalTokensOut, totalCacheWrites, totalCacheReads, totalCost } = getApiMetrics(
				task.combineMessages!(deletedMessages),
			)

			// Use MessageManager to properly handle context-management events
			// This ensures orphaned Summary messages and truncation markers are cleaned up
			await task.messageManager!.rewindToTimestamp(ts, {
				includeTargetMessage: operation === "edit",
			})

			// Report the deleted API request metrics
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

		// The task is already cancelled by the provider beforehand, but we
		// need to re-init to get the updated messages.
		//
		// This was taken from Cline's implementation of the checkpoints
		// feature. The task instance will hang if we don't cancel twice,
		// so this is currently necessary, but it seems like a complicated
		// and hacky solution to a problem that I don't fully understand.
		// I'd like to revisit this in the future and try to improve the
		// task flow and the communication between the webview and the
		// `Task` instance.
		provider?.postMessageToWebview({ type: "cancelTask" })
	} catch (err) {
		EventBridge.outputChannel?.appendLine("[checkpointRestore] disabling checkpoints for this task")
		task._state.setEnableCheckpoints(false)
	}
}

export type CheckpointDiffOptions = {
	ts?: number
	previousCommitHash?: string
	commitHash: string
	/**
	 * from-init: Compare from the first checkpoint to the selected checkpoint.
	 * checkpoint: Compare the selected checkpoint to the next checkpoint.
	 * to-current: Compare the selected checkpoint to the current workspace.
	 * full: Compare from the first checkpoint to the current workspace.
	 */
	mode: "from-init" | "checkpoint" | "to-current" | "full"
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

	let fromHash: string | undefined
	let toHash: string | undefined
	let title: string

	const checkpoints = task.messages
		.filter(({ say }: { say?: string }) => say === "checkpoint_saved")
		.map(({ text }: { text?: string }) => text!)

	if (["from-init", "full"].includes(mode) && checkpoints.length < 1) {
		vscode.window.showInformationMessage(t("common:errors.checkpoint_no_first"))
		return
	}

	const idx = checkpoints.indexOf(commitHash)
	switch (mode) {
		case "checkpoint":
			fromHash = commitHash
			toHash = idx !== -1 && idx < checkpoints.length - 1 ? checkpoints[idx + 1] : undefined
			title = t("common:errors.checkpoint_diff_with_next")
			break
		case "from-init":
			fromHash = checkpoints[0]
			toHash = commitHash
			title = t("common:errors.checkpoint_diff_since_first")
			break
		case "to-current":
			fromHash = commitHash
			toHash = undefined
			title = t("common:errors.checkpoint_diff_to_current")
			break
		case "full":
			fromHash = checkpoints[0]
			toHash = undefined
			title = t("common:errors.checkpoint_diff_since_first")
			break
	}

	if (!fromHash) {
		vscode.window.showInformationMessage(t("common:errors.checkpoint_no_previous"))
		return
	}

	try {
		const changes = await service.getDiff({ from: fromHash, to: toHash })

		if (!changes?.length) {
			vscode.window.showInformationMessage(t("common:errors.checkpoint_no_changes"))
			return
		}

		await vscode.commands.executeCommand(
			"vscode.changes",
			title,
			changes.map(
				(change: {
					paths: { absolute: string; relative: string }
					content: { before?: string; after?: string }
				}) => [
					vscode.Uri.file(change.paths.absolute),
					vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME_JABBERWOCK}:${change.paths.relative}`).with({
						query: Buffer.from(change.content.before ?? "").toString("base64"),
					}),
					vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME_JABBERWOCK}:${change.paths.relative}`).with({
						query: Buffer.from(change.content.after ?? "").toString("base64"),
					}),
				],
			),
		)
	} catch (err) {
		const provider = task.providerRef!.deref()
		EventBridge.outputChannel?.appendLine("[checkpointDiff] disabling checkpoints for this task")
		task._state.setEnableCheckpoints(false)
	}
}
