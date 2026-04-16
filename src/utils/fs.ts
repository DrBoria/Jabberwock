import { VirtualWorkspace, virtualWorkspace } from "../core/fs/VirtualWorkspace"
import * as path from "path"

/**
 * Asynchronously creates all non-existing subdirectories for a given file path
 * and collects them in an array for later deletion.
 * Supports both (filePath, vfs) and (vfs, filePath) signatures for backward compatibility.
 *
 * @param arg1 - Either filePath (string) or vfs (VirtualWorkspace).
 * @param arg2 - Either vfs (VirtualWorkspace) or filePath (string), or undefined.
 * @returns A promise that resolves to an array of newly created directories.
 */
export async function createDirectoriesForFile(
	arg1: string | VirtualWorkspace,
	arg2?: string | VirtualWorkspace,
): Promise<string[]> {
	let vfs: VirtualWorkspace
	let filePath: string

	if (typeof arg1 === "string") {
		filePath = arg1
		vfs = arg2 instanceof VirtualWorkspace ? arg2 : virtualWorkspace
	} else {
		vfs = arg1
		filePath = typeof arg2 === "string" ? arg2 : ""
	}

	const newDirectories: string[] = []
	const normalizedFilePath = path.normalize(filePath)
	const directoryPath = path.dirname(normalizedFilePath)

	let currentPath = directoryPath
	const dirsToCreate: string[] = []

	// Traverse up the directory tree and collect missing directories
	while (!(await fileExistsAtPath(currentPath, vfs))) {
		dirsToCreate.push(currentPath)
		const parentPath = path.dirname(currentPath)
		if (parentPath === currentPath) break // Safety break at root
		currentPath = parentPath
	}

	// Create directories from the topmost missing one down to the target directory
	for (let i = dirsToCreate.length - 1; i >= 0; i--) {
		await vfs.mkdir(dirsToCreate[i])
		newDirectories.push(dirsToCreate[i])
	}

	return newDirectories
}

/**
 * Helper function to check if a path exists.
 * Supports both (filePath, vfs) and (vfs, filePath) signatures for backward compatibility.
 *
 * @param arg1 - Either filePath (string) or vfs (VirtualWorkspace).
 * @param arg2 - Either vfs (VirtualWorkspace) or filePath (string), or undefined.
 * @returns A promise that resolves to true if the path exists, false otherwise.
 */
export async function fileExistsAtPath(
	arg1: string | VirtualWorkspace,
	arg2?: string | VirtualWorkspace,
): Promise<boolean> {
	let vfs: VirtualWorkspace
	let filePath: string

	if (typeof arg1 === "string") {
		filePath = arg1
		vfs = arg2 instanceof VirtualWorkspace ? arg2 : virtualWorkspace
	} else {
		vfs = arg1
		filePath = typeof arg2 === "string" ? arg2 : ""
	}

	try {
		await vfs.stat(filePath)
		return true
	} catch {
		return false
	}
}
