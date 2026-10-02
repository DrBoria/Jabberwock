import fs from "fs/promises"

/**
 * Read and parse a JSON file, returning `null` when the file does not exist.
 *
 * Shared by every storage loader (`loadSettings`, `loadToken`, …) so the
 * read → parse → ENOENT→null handling lives in one place instead of being
 * re-implemented per file.
 */
export async function readJsonFile<T>(filePath: string): Promise<T | null> {
	try {
		const data = await fs.readFile(filePath, "utf-8")
		return JSON.parse(data) as T
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return null
		}

		throw error
	}
}
