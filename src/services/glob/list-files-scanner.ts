import * as path from "path"
import { VirtualWorkspace } from "@features/foundation/time-machine/VirtualWorkspace"
import ignore from "ignore"
import type { ScanContext } from "./list-files-filter"
import { computeRecursionDecision, shouldIncludeDirectory } from "./list-files-filter"

/**
 * List directories with appropriate filtering
 */
export async function listFilteredDirectories(
	vfs: VirtualWorkspace,
	dirPath: string,
	recursive: boolean,
	ignoreInstance: ReturnType<typeof ignore>,
	limit?: number,
): Promise<string[]> {
	const absolutePath = path.resolve(dirPath)
	const directories: string[] = []
	let dirCount = 0
	const effectiveLimit = limit ?? Number.MAX_SAFE_INTEGER

	const isExplicitHiddenTarget = path.basename(absolutePath).startsWith(".")

	const initialContext: ScanContext = {
		isTargetDir: isExplicitHiddenTarget,
		insideExplicitHiddenTarget: isExplicitHiddenTarget,
		basePath: dirPath,
		ignoreInstance,
	}

	async function tryAddDirectory(dirName: string, fullDirPath: string, subdirContext: ScanContext): Promise<boolean> {
		if (!shouldIncludeDirectory(dirName, fullDirPath, subdirContext)) {
			return false
		}

		const formattedPath = fullDirPath.endsWith("/") ? fullDirPath : `${fullDirPath}/`
		directories.push(formattedPath)
		dirCount++

		return dirCount >= effectiveLimit
	}

	async function scanDirectory(currentPath: string, context: ScanContext): Promise<boolean> {
		if (dirCount >= effectiveLimit) {
			return true
		}

		try {
			const entries = await vfs.readdir(currentPath, { withFileTypes: true })

			for (const entry of entries) {
				if (dirCount >= effectiveLimit) {
					return true
				}

				if (entry.isDirectory() && !entry.isSymbolicLink()) {
					const dirName = entry.name
					const fullDirPath = path.join(currentPath, dirName)

					const subdirContext: ScanContext = {
						...context,
						isTargetDir: false,
					}

					const limitAfterAdd = await tryAddDirectory(dirName, fullDirPath, subdirContext)
					if (limitAfterAdd) {
						return true
					}

					const isHiddenDir = dirName.startsWith(".")
					const recursionDecision = computeRecursionDecision(dirName, isHiddenDir, context, recursive)
					if (recursionDecision) {
						const limitReached = await scanDirectory(fullDirPath, recursionDecision.newContext)
						if (limitReached) {
							return true
						}
					}
				}
			}
		} catch (err) {
			console.warn(`[jabberwock] Could not read directory ${currentPath}: ${err}`)
		}

		return false
	}

	await scanDirectory(absolutePath, initialContext)

	return directories
}
