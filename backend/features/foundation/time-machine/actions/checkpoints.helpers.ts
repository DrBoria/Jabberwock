import pWaitFor from "p-wait-for"

import type { ITaskModel } from "@features/chat/task/store"
import { t } from "@i18n"
import { getWorkspacePath } from "@utils/io/path"

import { CheckpointServiceOptions, RepoPerTaskCheckpointService, type CheckpointService } from "@services/checkpoints"
import { log as backendLog } from "@features/foundation/capabilities/backend-logger"
import { getProvider } from "@features/foundation/webview/providerRegistry"
import { getUiDialogs } from "@features/foundation/capabilities/registry"
import { getHostContext } from "@features/foundation/host-context/context"

import { WARNING_THRESHOLD_MS, sendCheckpointInitWarn } from "./checkpoints.warnings"
import { checkGitInstallation } from "./checkpoints.git"

export async function getCheckpointService(task: ITaskModel, { interval = 250 }: { interval?: number } = {}) {
	if (!task._state.enableCheckpoints) {
		return undefined
	}

	if (task.checkpointService) {
		return task.checkpointService
	}

	const provider = getProvider()

	const checkpointTimeoutMs = task._state.checkpointTimeout * 1000

	const log = (message: string) => {
		try {
			backendLog.info(message)
		} catch (_err) {
			// NO-OP
		}
	}

	try {
		return await initializeCheckpointService(task, provider, log, checkpointTimeoutMs, interval)
	} catch (err) {
		return handleCheckpointError(err, task, log)
	}
}

async function initializeCheckpointService(
	task: ITaskModel,
	provider: ReturnType<typeof getProvider>,
	log: (message: string) => void,
	checkpointTimeoutMs: number,
	interval: number,
): Promise<CheckpointService | undefined> {
	const workspaceDir = task.cwd || getWorkspacePath()

	if (!workspaceDir) {
		log("[Task#getCheckpointService] workspace folder not found, disabling checkpoints")
		task._state.setEnableCheckpoints(false)
		return undefined
	}

	const globalStorageDir = provider.context.globalStorageUri.fsPath

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
		return waitForServiceInit(task, checkpointTimeoutMs, interval)
	}

	if (!task._state.enableCheckpoints) {
		return undefined
	}

	const service = RepoPerTaskCheckpointService.create(options)
	task._state.setCheckpointServiceInitializing(true)
	await checkGitInstallation(task, service, log)
	task.checkpointService = service

	if (task._state.enableCheckpoints) {
		sendCheckpointInitWarn(task)
	}

	return service
}

async function waitForServiceInit(
	task: ITaskModel,
	checkpointTimeoutMs: number,
	interval: number,
): Promise<CheckpointService | undefined> {
	const checkpointInitStartTime = Date.now()
	let warningShown = false

	await pWaitFor(
		() => {
			const elapsed = Date.now() - checkpointInitStartTime

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
	}

	sendCheckpointInitWarn(task)
	return task.checkpointService
}

function handleCheckpointError(err: unknown, task: ITaskModel, log: (message: string) => void): undefined {
	const error = err instanceof Error ? err : new Error(String(err))
	if (error.name === "TimeoutError" && task._state.enableCheckpoints) {
		sendCheckpointInitWarn(task, "INIT_TIMEOUT", task._state.checkpointTimeout)
	}
	log(`[Task#getCheckpointService] ${error.message}`)
	task._state.setEnableCheckpoints(false)
	task._state.setCheckpointServiceInitializing(false)
	return undefined
}

export function isModeWithCheckpoint(mode: string): boolean {
	return mode === "from-init" || mode === "full"
}

export function resolveDiffConfig(
	mode: string,
	commitHash: string,
	checkpoints: string[],
): { fromHash: string | undefined; title: string } {
	switch (mode) {
		case "checkpoint":
			return {
				fromHash: commitHash,
				title: t("common:errors.checkpoint_diff_with_next"),
			}
		case "from-init":
			return {
				fromHash: checkpoints[0],
				title: t("common:errors.checkpoint_diff_since_first"),
			}
		case "to-current":
			return {
				fromHash: commitHash,
				title: t("common:errors.checkpoint_diff_to_current"),
			}
		case "full":
			return {
				fromHash: checkpoints[0],
				title: t("common:errors.checkpoint_diff_since_first"),
			}
		default:
			return {
				fromHash: undefined,
				title: "",
			}
	}
}

export async function showDiff(
	service: CheckpointService,
	diffConfig: { fromHash: string | undefined; title: string },
	_checkpoints: string[],
): Promise<void> {
	const { fromHash, title } = diffConfig
	const changes = await service.getDiff({ from: fromHash, to: undefined })

	if (!changes?.length) {
		await getUiDialogs().showInformationMessage(t("common:errors.checkpoint_no_changes"))
		return
	}

	// D4g-2 (batch 2): the host diff view is opened through the hostCommands slot instead of
	// importing "vscode" (plan §3.2 Strategy G). Server mode has no diff view, so this is a no-op.
	getHostContext()?.hostCommands?.showCheckpointDiff?.(title, changes)
}
