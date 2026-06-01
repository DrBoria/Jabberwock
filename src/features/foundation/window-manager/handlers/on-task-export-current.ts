import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "../../../intents/bus"
import { getTaskWithId } from "../../../history/actions"
import { downloadTask, getTaskFileName } from "../../../../integrations/misc/export-markdown"
import { resolveDefaultSaveUri, saveLastExportPath } from "../../../../utils/export"
import { getSettingsAccess } from "@utils/settings-access"
import * as os from "os"

/**
 * Handles foundation.task.export.current intent — exports the current active task as markdown.
 */
export function registerOnTaskExportCurrent(bus: IntentBus): void {
	bus.register(IntentType.FoundationTaskExportCurrent, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const currentTaskId = ctx.rootStore.chat.activeTask?.taskId
		if (currentTaskId) {
			const { historyItem } = await getTaskWithId(provider, currentTaskId)

			if (historyItem) {
				const fileName = getTaskFileName(historyItem.ts)
				const defaultUri = resolveDefaultSaveUri(getSettingsAccess(), "lastTaskExportPath", fileName, {
					useWorkspace: false,
					fallbackDir: os.homedir() + "/Downloads",
				})
				const saveUri = await downloadTask(historyItem.ts, [], defaultUri)
				if (saveUri) {
					await saveLastExportPath(getSettingsAccess(), "lastTaskExportPath", saveUri)
				}
			}
		}
	})
}
