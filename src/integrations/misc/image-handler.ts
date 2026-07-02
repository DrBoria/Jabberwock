import * as path from "path"
import * as os from "os"
import * as vscode from "vscode"
import { getWorkspacePath } from "@utils/io/path"
import { t } from "@i18n"

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
			await vscode.env.clipboard.writeText(filePath)
			vscode.window.showInformationMessage(t("common:info.path_copied_to_clipboard"))
			return
		}
		await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(filePath))
	} catch (error) {
		vscode.window.showErrorMessage(t("common:errors.error_opening_image", { error }))
	}
}

async function copyDataUriToClipboard(tempFilePath: string, format: string): Promise<void> {
	try {
		const imageData = await vscode.workspace.fs.readFile(vscode.Uri.file(tempFilePath))
		const base64Image = Buffer.from(imageData).toString("base64")
		const dataUri = `data:image/${format};base64,${base64Image}`
		await vscode.env.clipboard.writeText(dataUri)
		vscode.window.showInformationMessage(t("common:info.image_copied_to_clipboard"))
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		vscode.window.showErrorMessage(t("common:errors.error_copying_image", { errorMessage }))
	} finally {
		try {
			await vscode.workspace.fs.delete(vscode.Uri.file(tempFilePath))
		} catch {
			// Ignore cleanup errors
		}
	}
}

async function handleDataUriImage(dataUriOrPath: string, options?: { values?: { action?: string } }): Promise<void> {
	const matches = dataUriOrPath.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/)
	if (!matches) {
		vscode.window.showErrorMessage(t("common:errors.invalid_data_uri"))
		return
	}
	const [, format, base64Data] = matches
	const imageBuffer = Buffer.from(base64Data, "base64")

	const tempFilePath = path.join(os.tmpdir(), `temp_image_${Date.now()}.${format}`)
	try {
		await vscode.workspace.fs.writeFile(vscode.Uri.file(tempFilePath), imageBuffer)
		if (options?.values?.action === "copy") {
			await copyDataUriToClipboard(tempFilePath, format)
			return
		}
		await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(tempFilePath))
	} catch (error) {
		vscode.window.showErrorMessage(t("common:errors.error_opening_image", { error }))
	}
}

export async function openImage(dataUriOrPath: string, options?: { values?: { action?: string } }) {
	if (isFilePath(dataUriOrPath)) {
		await handleFilePathImage(dataUriOrPath, options)
		return
	}
	await handleDataUriImage(dataUriOrPath, options)
}

export async function saveImage(dataUri: string, defaultUri: vscode.Uri): Promise<vscode.Uri | undefined> {
	const matches = dataUri.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/)
	if (!matches) {
		vscode.window.showErrorMessage(t("common:errors.invalid_data_uri"))
		return undefined
	}
	const [, format, base64Data] = matches
	const imageBuffer = Buffer.from(base64Data, "base64")

	// Show save dialog
	const saveUri = await vscode.window.showSaveDialog({
		filters: {
			Images: [format],
			"All Files": ["*"],
		},
		defaultUri: defaultUri,
	})

	if (!saveUri) {
		// User cancelled the save dialog
		return undefined
	}

	try {
		// Write the image to the selected location
		await vscode.workspace.fs.writeFile(saveUri, imageBuffer)
		vscode.window.showInformationMessage(t("common:info.image_saved", { path: saveUri.fsPath }))
		return saveUri
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		vscode.window.showErrorMessage(t("common:errors.error_saving_image", { errorMessage }))
		return undefined
	}
}
