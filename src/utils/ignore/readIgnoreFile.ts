/**
 * Read .jabberwockignore content from disk.
 *
 * Pure utility — reads the file and returns its content as a string.
 * No state management, no side effects beyond file I/O.
 */
import path from "path"
import fs from "fs/promises"
import { fileExistsAtPath } from "../fs"

/**
 * Read .jabberwockignore from the given directory.
 * @param cwd - Directory to look for .jabberwockignore in
 * @returns File content as string, or undefined if file doesn't exist
 */
export async function readIgnoreFile(cwd: string): Promise<string | undefined> {
	try {
		const ignorePath = path.join(cwd, ".jabberwockignore")
		if (await fileExistsAtPath(ignorePath)) {
			return await fs.readFile(ignorePath, "utf8")
		}
	} catch (error) {
		console.error("[jabberwock] Unexpected error reading .jabberwockignore:", error)
	}
	return undefined
}
