import * as fs from "fs"
import * as path from "path"
import { execSync } from "child_process"

function copyDir(srcDir: string, dstDir: string, count: number): number {
	const entries = fs.readdirSync(srcDir, { withFileTypes: true })

	for (const entry of entries) {
		const srcPath = path.join(srcDir, entry.name)
		const dstPath = path.join(dstDir, entry.name)

		if (entry.isDirectory()) {
			fs.mkdirSync(dstPath, { recursive: true })
			count = copyDir(srcPath, dstPath, count)
		} else {
			count = count + 1
			fs.copyFileSync(srcPath, dstPath)
		}
	}

	return count
}

function isRetryableFsError(error: unknown): boolean {
	return (
		error instanceof Error &&
		"code" in error &&
		(error.code === "ENOTEMPTY" || error.code === "EBUSY" || error.code === "EPERM" || error.code === "EACCES")
	)
}

function clearReadonlyFlags(dirPath: string): void {
	if (process.platform !== "win32") {
		return
	}
	try {
		execSync(`attrib -R "${dirPath}\\*.*" /S /D`, { stdio: "ignore" })
	} catch {
		// Ignore attrib errors.
	}
}

function busyWait(delay: number): void {
	const start = Date.now()
	while (Date.now() - start < delay) {
		/* Busy wait */
	}
}

function attemptFinalCleanup(dirPath: string): void {
	console.warn(`[rmDir] Final attempt using alternative cleanup for ${dirPath}`)
	clearReadonlyFlags(dirPath)
	fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
}

function rmDir(dirPath: string, maxRetries: number = 5): void {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			fs.rmSync(dirPath, { recursive: true, force: true })
			return
		} catch (error) {
			if (attempt === maxRetries) {
				try {
					attemptFinalCleanup(dirPath)
					return
				} catch (finalError) {
					console.error(`[rmDir] Failed to remove ${dirPath} after ${maxRetries} attempts:`, finalError)
					throw finalError
				}
			}

			if (!isRetryableFsError(error)) {
				throw error
			}

			const baseDelay = process.platform === "win32" ? 200 : 100
			const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 2000)
			console.warn(`[rmDir] Attempt ${attempt} failed for ${dirPath}, retrying in ${delay}ms...`)
			busyWait(delay)
		}
	}
}

export { copyDir, isRetryableFsError, clearReadonlyFlags, busyWait, attemptFinalCleanup, rmDir }
