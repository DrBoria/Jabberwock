import * as path from "path"
import * as os from "os"
import * as fs from "fs/promises"
import type { IUri } from "@jabberwock/types"
import { getWorkspacePath } from "@utils/io/path"
import { t } from "@i18n"
import { getHostContext } from "@features/foundation/host-context/context"

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

async function findExistingUri(attemptPaths: string[]): Promise<{ isDirectory: boolean; uri: IUri } | undefined> {
	for (const p of attemptPaths) {
		try {
			// D4g-2 (batch 3): plain Node fs stat (the path is a local fs path) — replaces the
			// vscode.workspace.fs.stat call so this shared helper stays host-neutral.
			const stat = await fs.stat(p)
			return { isDirectory: stat.isDirectory(), uri: { fsPath: p } }
		} catch {
			// Path not found, try next
		}
	}
	return undefined
}

async function handleDirectory(uri: IUri): Promise<void> {
	// D4g-2 (batch 3): reveal the directory in the host explorer via the hostCommands slot
	// (D4g-pre) — server mode has no host explorer, so this degrades to a no-op.
	getHostContext()?.hostCommands?.revealInExplorer?.(uri.fsPath)
	try {
		getHostContext()?.hostCommands?.executeCommand?.("list.expand")
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
): Promise<IUri> {
	const pathToCreateAt = resolveCreationPath(originalPath, workspaceRoot, homeDir)
	const contentToCreate = options.content || ""
	// D4g-2 (batch 3): plain Node fs write (the path is a local fs path) — replaces the
	// vscode.workspace.fs.writeFile call so this shared helper stays host-neutral.
	await fs.writeFile(pathToCreateAt, Buffer.from(contentToCreate, "utf8"))
	return { fsPath: pathToCreateAt }
}

async function closeDuplicateTab(uriToProcess: IUri): Promise<void> {
	// D4g-2 (batch 3): close a cross-column duplicate tab via the hostCommands slot (D4g-pre) —
	// the vscode connector performs the tab-group close logic; server mode has no host tabs, so
	// this degrades to a no-op.
	getHostContext()?.hostCommands?.closeDuplicateTab?.(uriToProcess.fsPath)
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

		// D4g-2 (batch 3): open the file in the host editor via the hostCommands slot (D4g-pre) —
		// the vscode connector opens the text document with the requested line selection; server
		// mode has no host editor, so this degrades to a no-op.
		getHostContext()?.hostCommands?.openFileInEditor?.(uriToProcess.fsPath, {
			preview: false,
			line: options.line,
		})
	} catch (error) {
		showOpenFileError(error)
	}
}

async function resolveUri(
	found: { isDirectory: boolean; uri: IUri } | undefined,
	originalPath: string,
	options: OpenFileOptions,
	workspaceRoot: string | undefined,
	homeDir: string,
): Promise<IUri> {
	if (found) {
		if (found.isDirectory) {
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
		publishNotificationError(t("common:errors.could_not_open_file", { errorMessage: error.message }))
	} else {
		publishNotificationError(t("common:errors.could_not_open_file_generic"))
	}
}

import { publishNotificationError } from "@features/foundation/capabilities/notifications"
