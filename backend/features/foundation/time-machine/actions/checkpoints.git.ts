import type { ITaskModel } from "@features/chat/task/store"
import { checkGitInstalled } from "@utils/git"
import { t } from "@i18n"

import type { RepoPerTaskCheckpointService } from "@services/checkpoints"

import { sendCheckpointInitWarn } from "./checkpoints.warnings"
import { sendCurrentCheckpointUpdated } from "@features/foundation/time-machine/events/actions/sendCheckpointEvent"
import { systemBroadcast } from "@features/chat/task/messages/actions/say"
import { getMstState } from "@features/foundation/mst/store"
import { getBackendRootStore } from "@features/storeSingleton"
import { getUiDialogs } from "@features/foundation/capabilities/registry"
import { getHostContext } from "@features/foundation/host-context/context"

export async function checkGitInstallation(
	task: ITaskModel,
	service: RepoPerTaskCheckpointService,
	log: (message: string) => void,
) {
	try {
		const gitInstalled = await checkGitInstalled()

		if (!gitInstalled) {
			log("[Task#getCheckpointService] Git is not installed, disabling checkpoints")
			task._state.setEnableCheckpoints(false)
			task._state.setCheckpointServiceInitializing(false)

			const selection = await getUiDialogs().showWarningMessage(t("common:errors.git_not_installed"), [
				t("common:buttons.learn_more"),
			])

			if (selection === t("common:buttons.learn_more")) {
				getHostContext()?.hostCommands?.openExternal?.("https://git-scm.com/downloads")
			}

			return
		}

		service.on("initialize", () => {
			task._state.setCheckpointServiceInitializing(false)
		})

		service.on("checkpoint", ({ fromHash: from, toHash: to, suppressMessage }) => {
			try {
				sendCheckpointInitWarn(task)
				sendCurrentCheckpointUpdated(to, !!suppressMessage)
				getMstState(getBackendRootStore()).checkpointStore?.setCurrentCheckpoint(to)

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
