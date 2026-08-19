import * as vscode from "vscode"
import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"
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
		vscode.window.showErrorMessage(`File not found: ${fileName}`)
		return
	}

	const content = await fs.readFile(sourceFilePath, "utf8")
	let jsonContent: unknown

	try {
		jsonContent = JSON.parse(content)
	} catch {
		vscode.window.showErrorMessage(`Failed to parse ${fileName}`)
		return
	}

	const prettifiedContent = JSON.stringify(jsonContent, null, 2)

	const tmpDir = os.tmpdir()
	const timestamp = Date.now()
	const tempFileName = `jabberwock-${prefix}-${taskId.slice(0, 8)}-${timestamp}.json`
	const tempFilePath = path.join(tmpDir, tempFileName)

	await fs.writeFile(tempFilePath, prettifiedContent, "utf8")

	const doc = await vscode.workspace.openTextDocument(tempFilePath)
	await vscode.window.showTextDocument(doc, { preview: true })
}
