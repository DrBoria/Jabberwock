import * as fs from "fs/promises"
import * as fsSync from "fs"
import * as path from "path"
import * as lockfile from "proper-lockfile"
import { JsonStreamStringify } from "json-stream-stringify"

/**
 * Options for safeWriteJson function
 */
export interface SafeWriteJsonOptions {
	/**
	 * Whether to pretty-print the JSON output with indentation.
	 * When true, uses tab characters for indentation.
	 * When false or undefined, outputs compact JSON.
	 * @default false
	 */
	prettyPrint?: boolean
}

/**
 * Safely writes JSON data to a file.
 * - Creates parent directories if they don't exist
 * - Uses 'proper-lockfile' for inter-process advisory locking to prevent concurrent writes to the same path.
 * - Writes to a temporary file first.
 * - If the target file exists, it's backed up before being replaced.
 * - Attempts to roll back and clean up in case of errors.
 * - Supports pretty-printing with indentation while maintaining streaming efficiency.
 *
 * @param {string} filePath - The absolute path to the target file.
 * @param {any} data - The data to serialize to JSON and write.
 * @param {SafeWriteJsonOptions} options - Optional configuration for JSON formatting.
 * @returns {Promise<void>}
 */

async function ensureDir(dirPath: string): Promise<void> {
	try {
		await fs.mkdir(dirPath, { recursive: true })
		await fs.access(dirPath)
	} catch (dirError) {
		console.error(`[jabberwock] Failed to create or access directory for ${dirPath}:`, dirError)
		throw dirError
	}
}

function createTempFilePath(dir: string, baseName: string, prefix: string): string {
	return path.join(dir, `.${baseName}.${prefix}_${Date.now()}_${Math.random().toString(36).substring(2)}.tmp`)
}

async function acquireLock(absoluteFilePath: string): Promise<() => Promise<void>> {
	try {
		return await lockfile.lock(absoluteFilePath, {
			stale: 31000,
			update: 10000,
			realpath: false,
			retries: { retries: 5, factor: 2, minTimeout: 100, maxTimeout: 1000 },
			onCompromised: (err) => {
				console.error(`[jabberwock] Lock at ${absoluteFilePath} was compromised:`, err)
				throw err
			},
		})
	} catch (lockError) {
		console.error(`[jabberwock] Failed to acquire lock for ${absoluteFilePath}:`, lockError)
		throw lockError
	}
}

async function backupExistingFile(absoluteFilePath: string): Promise<string | null> {
	try {
		await fs.access(absoluteFilePath)
		const backupPath = createTempFilePath(path.dirname(absoluteFilePath), path.basename(absoluteFilePath), "bak")
		await fs.rename(absoluteFilePath, backupPath)
		return backupPath
	} catch (accessError) {
		if ((accessError as NodeJS.ErrnoException).code !== "ENOENT") {
			throw accessError
		}
		return null
	}
}

async function cleanupBackup(backupPath: string | null): Promise<void> {
	if (!backupPath) return
	try {
		await fs.unlink(backupPath)
	} catch (error) {
		console.error(`[jabberwock] Failed to clean up backup ${backupPath}:`, error)
	}
}

async function rollbackBackup(backupPath: string | null, absoluteFilePath: string): Promise<boolean> {
	if (!backupPath) return false
	try {
		await fs.rename(backupPath, absoluteFilePath)
		return true
	} catch (rollbackError) {
		console.error(`[jabberwock] Failed to restore backup ${backupPath} to ${absoluteFilePath}:`, rollbackError)
		return false
	}
}

async function cleanupTempFile(filePath: string | null): Promise<void> {
	if (!filePath) return
	try {
		await fs.unlink(filePath)
	} catch (error) {
		console.error(`[jabberwock] Failed to clean up temp file ${filePath}:`, error)
	}
}

async function safeWriteJson(filePath: string, data: unknown, options?: SafeWriteJsonOptions): Promise<void> {
	const absoluteFilePath = path.resolve(filePath)
	const dirPath = path.dirname(absoluteFilePath)

	await ensureDir(dirPath)
	const releaseLock = await acquireLock(absoluteFilePath)

	let tempNewFilePath: string | null = null
	let tempBackupFilePath: string | null = null

	try {
		tempNewFilePath = createTempFilePath(dirPath, path.basename(absoluteFilePath), "new")
		await _streamDataToFile(tempNewFilePath, data, options?.prettyPrint)

		tempBackupFilePath = await backupExistingFile(absoluteFilePath)

		await fs.rename(tempNewFilePath, absoluteFilePath)
		tempNewFilePath = null

		await cleanupBackup(tempBackupFilePath)
		tempBackupFilePath = null
	} catch (originalError) {
		console.error(`[jabberwock] Operation failed for ${absoluteFilePath}:`, originalError)

		const wasRolledBack = await rollbackBackup(tempBackupFilePath, absoluteFilePath)
		if (wasRolledBack) {
			tempBackupFilePath = null
		}

		await cleanupTempFile(tempNewFilePath)
		await cleanupTempFile(tempBackupFilePath)
		throw originalError
	} finally {
		try {
			await releaseLock()
		} catch (unlockError) {
			console.error(`[jabberwock] Failed to release lock for ${absoluteFilePath}:`, unlockError)
		}
	}
}

/**
 * Helper function to stream JSON data to a file.
 * @param targetPath The path to write the stream to.
 * @param data The data to stream.
 * @param prettyPrint Whether to format the JSON with indentation.
 * @returns Promise<void>
 */
async function _streamDataToFile(targetPath: string, data: unknown, prettyPrint = false): Promise<void> {
	// Stream data to avoid high memory usage for large JSON objects.
	const fileWriteStream = fsSync.createWriteStream(targetPath, { encoding: "utf8" })

	// JsonStreamStringify traverses the object and streams tokens directly
	// The 'spaces' parameter adds indentation during streaming, not via a separate pass
	// Convert undefined to null for valid JSON serialization (undefined is not valid JSON)
	const stringifyStream = new JsonStreamStringify(
		data === undefined ? null : data,
		undefined, // replacer
		prettyPrint ? "\t" : undefined, // spaces for indentation
	)

	return new Promise<void>((resolve, reject) => {
		stringifyStream.on("error", reject)
		fileWriteStream.on("error", reject)
		fileWriteStream.on("finish", resolve)
		stringifyStream.pipe(fileWriteStream)
	})
}

export { safeWriteJson }
