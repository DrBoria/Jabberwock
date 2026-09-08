import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"
import { getHostContext } from "@features/foundation/host-context/context"
import { getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"
import type { TelemetrySetting } from "@jabberwock/types"
import { getTaskDirectoryPath } from "@utils/io"
import { fileExistsAtPath } from "@utils/io/fs"

export function captureTelemetryChange(
	wasOptedIn: boolean,
	isOptedIn: boolean,
	previousSetting: TelemetrySetting,
	currentSetting: TelemetrySetting,
): void {
	if (!hasTelemetryService()) {
		return
	}
	if (wasOptedIn && !isOptedIn) {
		getTelemetryService().captureTelemetrySettingsChanged(previousSetting, currentSetting)
	}
	if (!wasOptedIn && isOptedIn) {
		getTelemetryService().captureTelemetrySettingsChanged(previousSetting, currentSetting)
	}
}

export async function openDebugHistoryFile(
	taskId: string,
	globalStoragePath: string,
	fileName: string,
	prefix: string,
): Promise<void> {
	const taskDirPath = await getTaskDirectoryPath(globalStoragePath, taskId)
	const sourceFilePath = path.join(taskDirPath, fileName)

	if (!(await fileExistsAtPath(sourceFilePath))) {
		publishNotificationError(`File not found: ${fileName}`)
		return
	}

	const content = await fs.readFile(sourceFilePath, "utf8")
	let jsonContent: unknown

	try {
		jsonContent = JSON.parse(content)
	} catch {
		publishNotificationError(`Failed to parse ${fileName}`)
		return
	}

	const prettifiedContent = JSON.stringify(jsonContent, null, 2)

	const tmpDir = os.tmpdir()
	const timestamp = Date.now()
	const tempFileName = `jabberwock-${prefix}-${taskId.slice(0, 8)}-${timestamp}.json`
	const tempFilePath = path.join(tmpDir, tempFileName)

	await fs.writeFile(tempFilePath, prettifiedContent, "utf8")

	// D4g-2 (batch 3): open the temp file in the host editor via the hostCommands slot (D4g-pre) —
	// server mode has no host editor, so this degrades to a no-op.
	getHostContext()?.hostCommands?.openFileInEditor?.(tempFilePath, { preview: true })
}

import { publishNotificationError } from "@features/foundation/capabilities/notifications"
