import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { getTaskWithId } from "@features/hist/actions"
import { downloadTask, getTaskFileName } from "@integrations/misc/export-markdown"
import { resolveDefaultSaveUri, saveLastExportPath } from "@utils/io/export"
import { getSettingsAccess } from "@utils/settings"
import * as os from "os"

/**
 * Handles foundation.task.export intent — exports a task as markdown by ID.
 */
export function registerOnTaskExport(bus: IntentBus): void {
	bus.register(IntentType.FoundationTaskExport, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { text: string }
		const id = payload.text!

		const { historyItem } = await getTaskWithId(id)

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
	})
}
