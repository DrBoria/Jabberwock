import * as path from "path"

import { getWorkspaceRoots } from "@features/foundation/vscode/context"

/**
 * Checks if a file path is outside all workspace folders.
 * Workspace roots come from the host context DI slot (v4 B2 — L4), not vscode directly.
 * @param filePath The file path to check
 * @returns true if the path is outside all workspace folders, false otherwise
 */
export function isPathOutsideWorkspace(filePath: string): boolean {
	// If there are no workspace folders, consider everything outside workspace for safety
	const folderPaths = getWorkspaceRoots()
	if (folderPaths.length === 0) {
		return true
	}

	// Normalize and resolve the path to handle .. and . components correctly
	const absolutePath = path.resolve(filePath)

	// Check if the path is within any workspace folder
	return !folderPaths.some((folderPath) => {
		// Path is inside a workspace if it equals the workspace path or is a subfolder
		return absolutePath === folderPath || absolutePath.startsWith(folderPath + path.sep)
	})
}
