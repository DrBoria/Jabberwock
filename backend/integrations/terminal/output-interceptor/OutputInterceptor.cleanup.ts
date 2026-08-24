import * as fs from "fs"
import * as path from "path"

export async function cleanupOutputArtifacts(storageDir: string): Promise<void> {
	try {
		const files = await fs.promises.readdir(storageDir)
		for (const file of files) {
			if (file.startsWith("cmd-")) {
				await fs.promises.unlink(path.join(storageDir, file)).catch(() => {})
			}
		}
	} catch {
		// Directory doesn't exist, nothing to clean
	}
}

export async function cleanupOutputArtifactsByIds(storageDir: string, executionIds: Set<string>): Promise<void> {
	try {
		const files = await fs.promises.readdir(storageDir)
		for (const file of files) {
			const match = file.match(/^cmd-(\d+)\.txt$/)
			if (match && !executionIds.has(match[1])) {
				await fs.promises.unlink(path.join(storageDir, file)).catch(() => {})
			}
		}
	} catch {
		// Directory doesn't exist, nothing to clean
	}
}
