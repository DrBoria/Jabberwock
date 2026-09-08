import * as path from "path"
import * as os from "os"
import * as fs from "fs/promises"
import type { IUri } from "@jabberwock/types"
import { getWorkspacePath } from "@utils/io/path"
import { t } from "@i18n"
import { getClipboard, getUiDialogs } from "@features/foundation/capabilities/registry"
import { getHostContext } from "@features/foundation/host-context/context"

function isFilePath(dataUriOrPath: string): boolean {
	return (
		!dataUriOrPath.startsWith("data:") &&
		!dataUriOrPath.startsWith("http:") &&
		!dataUriOrPath.startsWith("https:") &&
		!dataUriOrPath.startsWith("vscode-resource:") &&
		!dataUriOrPath.startsWith("file+.vscode-resource")
	)
}

function resolveImagePath(dataUriOrPath: string): string {
	if (path.isAbsolute(dataUriOrPath)) {
		return dataUriOrPath
	}
	const workspacePath = getWorkspacePath()
	if (workspacePath) {
		return path.join(workspacePath, dataUriOrPath)
	}
	return dataUriOrPath
}

async function handleFilePathImage(dataUriOrPath: string, options?: { values?: { action?: string } }): Promise<void> {
	try {
		const filePath = resolveImagePath(dataUriOrPath)
		if (options?.values?.action === "copy") {
			// D4g-2 (batch 3): clipboard + toast via the capability slots (D4c) — server mode has
			// no host clipboard, so the copy degrades to a no-op.
			await getClipboard()?.writeText(filePath)
			await getUiDialogs().showInformationMessage(t("common:info.path_copied_to_clipboard"))
			return
		}
		// D4g-2 (batch 3): open the image with the host's default handler via the hostCommands slot
		// (D4g-pre) — server mode has no host, so this degrades to a no-op.
		getHostContext()?.hostCommands?.openWithDefaultHandler?.(filePath)
	} catch (error) {
		publishNotificationError(t("common:errors.error_opening_image", { error }))
	}
}

async function copyDataUriToClipboard(tempFilePath: string, format: string): Promise<void> {
	try {
		// D4g-2 (batch 3): plain Node fs (the temp file is a local path) + clipboard/toast via the
		// capability slots (D4c) — server mode has no host clipboard, so the copy degrades to a no-op.
		const imageData = await fs.readFile(tempFilePath)
		const base64Image = Buffer.from(imageData).toString("base64")
		const dataUri = `data:image/${format};base64,${base64Image}`
		await getClipboard()?.writeText(dataUri)
		await getUiDialogs().showInformationMessage(t("common:info.image_copied_to_clipboard"))
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		publishNotificationError(t("common:errors.error_copying_image", { errorMessage }))
	} finally {
		try {
			await fs.rm(tempFilePath, { force: true })
		} catch {
			// Ignore cleanup errors
		}
	}
}

async function handleDataUriImage(dataUriOrPath: string, options?: { values?: { action?: string } }): Promise<void> {
	const matches = dataUriOrPath.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/)
	if (!matches) {
		publishNotificationError(t("common:errors.invalid_data_uri"))
		return
	}
	const [, format, base64Data] = matches
	const imageBuffer = Buffer.from(base64Data, "base64")

	const tempFilePath = path.join(os.tmpdir(), `temp_image_${Date.now()}.${format}`)
	try {
		// D4g-2 (batch 3): plain Node fs for the local temp file + host open via the hostCommands
		// slot (D4g-pre) — server mode has no host, so the open degrades to a no-op.
		await fs.writeFile(tempFilePath, imageBuffer)
		if (options?.values?.action === "copy") {
			await copyDataUriToClipboard(tempFilePath, format)
			return
		}
		getHostContext()?.hostCommands?.openWithDefaultHandler?.(tempFilePath)
	} catch (error) {
		publishNotificationError(t("common:errors.error_opening_image", { error }))
	}
}

export async function openImage(dataUriOrPath: string, options?: { values?: { action?: string } }) {
	if (isFilePath(dataUriOrPath)) {
		await handleFilePathImage(dataUriOrPath, options)
		return
	}
	await handleDataUriImage(dataUriOrPath, options)
}

export async function saveImage(dataUri: string, defaultUri: IUri): Promise<IUri | undefined> {
	const matches = dataUri.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/)
	if (!matches) {
		publishNotificationError(t("common:errors.invalid_data_uri"))
		return undefined
	}
	const [, format, base64Data] = matches
	const imageBuffer = Buffer.from(base64Data, "base64")

	// D4g-2 (batch 3): save dialog via the uiDialogs slot (D4c) — server mode resolves undefined
	// (no dialog), so the save is cancelled headless.
	const saveUri = await getUiDialogs().showSaveDialog({
		filters: {
			Images: [format],
			"All Files": ["*"],
		},
		defaultUri,
	})

	if (!saveUri) {
		// User cancelled the save dialog
		return undefined
	}

	try {
		// Write the image to the selected location (plain Node fs — the path is a local fs path).
		await fs.writeFile(saveUri.fsPath, imageBuffer)
		await getUiDialogs().showInformationMessage(t("common:info.image_saved", { path: saveUri.fsPath }))
		return saveUri
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		publishNotificationError(t("common:errors.error_saving_image", { errorMessage }))
		return undefined
	}
}

import { publishNotificationError } from "@features/foundation/capabilities/notifications"
