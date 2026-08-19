import * as path from "path"
import * as os from "os"
import { executeRipgrep } from "@services/search/file-search"
import fs from "fs/promises"

/**
 * Gets the global .jabberwock directory path based on the current platform
 *
 * @returns The absolute path to the global .jabberwock directory
 */
export function getGlobalRooDirectory(): string {
	const homeDir = os.homedir()
	return path.join(homeDir, ".jabberwock")
}

/**
 * Gets the global .agents directory path based on the current platform.
 * This is a shared directory for agent skills across different AI coding tools.
 *
 * @returns The absolute path to the global .agents directory
 */
export function getGlobalAgentsDirectory(): string {
	const homeDir = os.homedir()
	return path.join(homeDir, ".agents")
}

/**
 * Gets the project-local .agents directory path for a given cwd.
 */
export function getProjectAgentsDirectoryForCwd(cwd: string): string {
	if (!cwd) {
		throw new Error("cwd is required")
	}
	return path.join(cwd, ".agents")
}

/**
 * Gets the project-local .jabberwock directory path for a given cwd
 */
export function getProjectRooDirectoryForCwd(cwd: string): string {
	if (!cwd) {
		throw new Error("cwd is required")
	}
	return path.join(cwd, ".jabberwock")
}

/**
 * Checks if a directory exists
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
	try {
		const stat = await fs.stat(dirPath)
		return stat.isDirectory()
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT" || (error as NodeJS.ErrnoException).code === "ENOTDIR") {
			return false
		}
		throw error
	}
}

/**
 * Checks if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
	try {
		const stat = await fs.stat(filePath)
		return stat.isFile()
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT" || (error as NodeJS.ErrnoException).code === "ENOTDIR") {
			return false
		}
		throw error
	}
}

/**
 * Reads a file safely, returning null if it doesn't exist
 */
export async function readFileIfExists(filePath: string): Promise<string | null> {
	try {
		return await fs.readFile(filePath, "utf-8")
	} catch (error) {
		if (
			(error as NodeJS.ErrnoException).code === "ENOENT" ||
			(error as NodeJS.ErrnoException).code === "ENOTDIR" ||
			(error as NodeJS.ErrnoException).code === "EISDIR"
		) {
			return null
		}
		throw error
	}
}

/**
 * Discovers all .jabberwock directories in subdirectories of the workspace
 */
export async function discoverSubfolderRooDirectories(cwd: string): Promise<string[]> {
	try {
		const args = [
			"--files",
			"--hidden",
			"--follow",
			"-g",
			"**/.jabberwock/**",
			"-g",
			"!node_modules/**",
			"-g",
			"!.git/**",
			cwd,
		]

		const results = await executeRipgrep({ args, workspacePath: cwd })

		const rooDirs = new Set<string>()
		const rootRooDir = path.join(cwd, ".jabberwock")

		for (const result of results) {
			const match = result.path.match(/^(.+?)[/\\]\.jabberwock[/\\]/)
			if (match) {
				const rooDir = path.join(cwd, match[1], ".jabberwock")
				if (rooDir !== rootRooDir) {
					rooDirs.add(rooDir)
				}
			}
		}

		return Array.from(rooDirs).sort()
	} catch (_error) {
		return []
	}
}

/**
 * Gets the ordered list of .jabberwock directories to check (global first, then project-local)
 */
export function getRooDirectoriesForCwd(cwd: string): string[] {
	const directories: string[] = []

	directories.push(getGlobalRooDirectory())
	directories.push(getProjectRooDirectoryForCwd(cwd))

	return directories
}

/**
 * Gets the ordered list of all .jabberwock directories including subdirectories
 */
export async function getAllRooDirectoriesForCwd(cwd: string): Promise<string[]> {
	const directories: string[] = []

	directories.push(getGlobalRooDirectory())
	directories.push(getProjectRooDirectoryForCwd(cwd))

	const subfolderDirs = await discoverSubfolderRooDirectories(cwd)
	directories.push(...subfolderDirs)

	return directories
}

/**
 * Gets parent directories containing .jabberwock folders, in order from root to subfolders
 */
export async function getAgentsDirectoriesForCwd(cwd: string): Promise<string[]> {
	const directories: string[] = []

	directories.push(cwd)

	const subfolderRooDirs = await discoverSubfolderRooDirectories(cwd)

	for (const rooDir of subfolderRooDirs) {
		const parentDir = path.dirname(rooDir)
		directories.push(parentDir)
	}

	return directories
}

/**
 * Loads configuration from multiple .jabberwock directories with project overriding global
 */
export async function loadConfiguration(
	relativePath: string,
	cwd: string,
): Promise<{
	global: string | null
	project: string | null
	merged: string
}> {
	const globalDir = getGlobalRooDirectory()
	const projectDir = getProjectRooDirectoryForCwd(cwd)

	const globalFilePath = path.join(globalDir, relativePath)
	const projectFilePath = path.join(projectDir, relativePath)

	const globalContent = await readFileIfExists(globalFilePath)
	const projectContent = await readFileIfExists(projectFilePath)

	let merged = ""

	if (globalContent) {
		merged += globalContent
	}

	if (projectContent) {
		if (merged) {
			merged += "\n\n# Project-specific rules (override global):\n\n"
		}
		merged += projectContent
	}

	return {
		global: globalContent,
		project: projectContent,
		merged: merged || "",
	}
}

// Export with backward compatibility alias
export const loadRooConfiguration: typeof loadConfiguration = loadConfiguration
