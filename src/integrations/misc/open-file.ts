import * as path from "path"
import * as os from "os"
import * as vscode from "vscode"
import { arePathsEqual, getWorkspacePath } from "@utils/io/path"
import { t } from "@i18n"

interface OpenFileOptions {
	create?: boolean
	content?: string
	line?: number
}

function resolveAttemptPaths(filePath: string, workspaceRoot: string | undefined, homeDir: string): string[] {
	if (!filePath.startsWith("./")) {
		return [filePath]
	}
	const relativePart = filePath.slice(2)
	const paths: string[] = []
	if (workspaceRoot) {
		paths.push(path.join(workspaceRoot, relativePart))
	}
	const homePath = path.join(homeDir, relativePart)
	if (!paths.includes(homePath)) {
		paths.push(homePath)
	}
	if (paths.length === 0) {
		paths.push(filePath)
	}
	return paths
}

async function findExistingUri(
	attemptPaths: string[],
): Promise<{ stat: vscode.FileStat; uri: vscode.Uri } | undefined> {
	for (const p of attemptPaths) {
		try {
			const tempUri = vscode.Uri.file(p)
			const stat = await vscode.workspace.fs.stat(tempUri)
			return { stat, uri: tempUri }
		} catch {
			// Path not found, try next
		}
	}
	return undefined
}

async function handleDirectory(uri: vscode.Uri): Promise<void> {
	await vscode.commands.executeCommand("revealInExplorer", uri)
	try {
		await vscode.commands.executeCommand("list.expand")
	} catch (expandError) {
		console.warn("[jabberwock] Could not expand directory in explorer:", expandError)
	}
}

function resolveCreationPath(originalPath: string, workspaceRoot: string | undefined, homeDir: string): string {
	if (!originalPath.startsWith("./")) {
		return originalPath
	}
	const relativePart = originalPath.slice(2)
	if (workspaceRoot) {
		return path.join(workspaceRoot, relativePart)
	}
	if (homeDir) {
		return path.join(homeDir, relativePart)
	}
	return originalPath
}

async function createFile(
	originalPath: string,
	options: OpenFileOptions,
	workspaceRoot: string | undefined,
	homeDir: string,
): Promise<vscode.Uri> {
	const pathToCreateAt = resolveCreationPath(originalPath, workspaceRoot, homeDir)
	const uri = vscode.Uri.file(pathToCreateAt)
	const contentToCreate = options.content || ""
	await vscode.workspace.fs.writeFile(uri, Buffer.from(contentToCreate, "utf8"))
	return uri
}

async function closeDuplicateTab(uriToProcess: vscode.Uri): Promise<void> {
	try {
		for (const group of vscode.window.tabGroups.all) {
			const existingTab = group.tabs.find(
				(tab) =>
					tab.input instanceof vscode.TabInputText &&
					arePathsEqual(tab.input.uri.fsPath, uriToProcess.fsPath),
			)
			if (existingTab) {
				const activeColumn = vscode.window.activeTextEditor?.viewColumn
				const tabColumn = vscode.window.tabGroups.all.find((g) => g.tabs.includes(existingTab))?.viewColumn
				if (activeColumn && activeColumn !== tabColumn && !existingTab.isDirty) {
					await vscode.window.tabGroups.close(existingTab)
				}
				break
			}
		}
	} catch {
		// Tab operations sometimes fail; non-essential
	}
}

export async function openFile(filePath: string, options: OpenFileOptions = {}) {
	try {
		const originalFilePathForError = filePath
		try {
			filePath = decodeURIComponent(filePath)
		} catch {
			console.warn(`[jabberwock] Failed to decode file path. Using original path.`)
		}

		const workspaceRoot = getWorkspacePath()
		const homeDir = os.homedir()
		const attemptPaths = resolveAttemptPaths(filePath, workspaceRoot, homeDir)
		const found = await findExistingUri(attemptPaths)

		const uriToProcess = await resolveUri(found, originalFilePathForError, options, workspaceRoot, homeDir)

		await closeDuplicateTab(uriToProcess)

		const document = await vscode.workspace.openTextDocument(uriToProcess)
		const selection =
			options.line !== undefined
				? new vscode.Selection(Math.max(options.line - 1, 0), 0, Math.max(options.line - 1, 0), 0)
				: undefined
		await vscode.window.showTextDocument(document, { preview: false, selection })
	} catch (error) {
		showOpenFileError(error)
	}
}

async function resolveUri(
	found: { stat: vscode.FileStat; uri: vscode.Uri } | undefined,
	originalPath: string,
	options: OpenFileOptions,
	workspaceRoot: string | undefined,
	homeDir: string,
): Promise<vscode.Uri> {
	if (found) {
		if (found.stat.type === vscode.FileType.Directory) {
			await handleDirectory(found.uri)
			throw new OpenFileSkipError()
		}
		return found.uri
	}

	if (options.create && !isPathEndingWithSlash(originalPath)) {
		return await createFile(originalPath, options, workspaceRoot, homeDir)
	}

	throw new Error(`Path does not exist: ${originalPath}`)
}

function isPathEndingWithSlash(filePath: string): boolean {
	return filePath.endsWith("/") || filePath.endsWith("\\")
}

class OpenFileSkipError extends Error {
	constructor() {
		super()
		this.name = "OpenFileSkipError"
	}
}

function showOpenFileError(error: unknown): void {
	if (error instanceof OpenFileSkipError) {
		return
	}
	if (error instanceof Error) {
		vscode.window.showErrorMessage(t("common:errors.could_not_open_file", { errorMessage: error.message }))
	} else {
		vscode.window.showErrorMessage(t("common:errors.could_not_open_file_generic"))
	}
}
