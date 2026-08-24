import fs from "fs/promises"
import * as path from "path"
import { getGlobalRooDirectory, getProjectRooDirectoryForCwd } from "@services/jabberwock-config"
import { getBuiltInCommands, getBuiltInCommand } from "./built-in-commands"
import {
	resolveCommandDirectoryEntry,
	parseCommandFrontmatter,
	tryLoadCommand,
	tryReadCommandFile,
	type CommandFileInfo,
} from "./commands-resolve"

export interface Command {
	name: string
	content: string
	source: "global" | "project" | "built-in"
	filePath: string
	description?: string
	argumentHint?: string
	mode?: string
}

/**
 * Get all available commands from built-in, global, and project directories
 * Priority order: project > global > built-in (later sources override earlier ones)
 */
export async function getCommands(cwd: string): Promise<Command[]> {
	const commands = new Map<string, Command>()

	// Add built-in commands first (lowest priority)
	const builtInCommands = await getBuiltInCommands()
	for (const command of builtInCommands) {
		commands.set(command.name, command)
	}

	// Scan global commands (override built-in)
	const globalDir = path.join(getGlobalRooDirectory(), "commands")
	await scanCommandDirectory(globalDir, "global", commands)

	// Scan project commands (highest priority - override both global and built-in)
	const projectDir = path.join(getProjectRooDirectoryForCwd(cwd), "commands")
	await scanCommandDirectory(projectDir, "project", commands)

	return Array.from(commands.values())
}

/**
 * Get a specific command by name (optimized to avoid scanning all commands)
 * Priority order: project > global > built-in
 */
export async function getCommand(cwd: string, name: string): Promise<Command | undefined> {
	// Try to find the command directly without scanning all commands
	const projectDir = path.join(getProjectRooDirectoryForCwd(cwd), "commands")
	const globalDir = path.join(getGlobalRooDirectory(), "commands")

	// Check project directory first (highest priority)
	const projectCommand = await tryLoadCommand(
		projectDir,
		name,
		"project",
		tryReadCommandFile,
		parseCommandFrontmatter,
	)
	if (projectCommand) {
		return projectCommand
	}

	// Check global directory if not found in project
	const globalCommand = await tryLoadCommand(globalDir, name, "global", tryReadCommandFile, parseCommandFrontmatter)
	if (globalCommand) {
		return globalCommand
	}

	// Check built-in commands if not found in project or global (lowest priority)
	return await getBuiltInCommand(name)
}

/**
 * Get command names for autocomplete
 */
export async function getCommandNames(cwd: string): Promise<string[]> {
	const commands = await getCommands(cwd)
	return commands.map((cmd) => cmd.name)
}

/**
 * Scan a specific command directory (supports symlinks)
 */
async function scanCommandDirectory(
	dirPath: string,
	source: "global" | "project",
	commands: Map<string, Command>,
): Promise<void> {
	try {
		const stats = await fs.stat(dirPath)
		if (!stats.isDirectory()) {
			return
		}

		const entries = await fs.readdir(dirPath, { withFileTypes: true })
		const fileInfo: CommandFileInfo[] = []
		const initialPromises: Promise<void>[] = []

		for (const entry of entries) {
			initialPromises.push(resolveCommandDirectoryEntry(entry, dirPath, fileInfo, 0))
		}

		await Promise.all(initialPromises)

		for (const { originalPath, resolvedPath } of fileInfo) {
			await processCommandFile(originalPath, resolvedPath, source, commands)
		}
	} catch {
		// Directory doesn't exist or can't be read - this is fine
	}
}

async function processCommandFile(
	originalPath: string,
	resolvedPath: string,
	source: "global" | "project",
	commands: Map<string, Command>,
): Promise<void> {
	const commandName = getCommandNameFromFile(path.basename(originalPath))

	try {
		const content = await fs.readFile(resolvedPath, "utf-8")
		const { description, argumentHint, mode, commandContent } = parseCommandFrontmatter(content)

		if (source === "project" || !commands.has(commandName)) {
			commands.set(commandName, {
				name: commandName,
				content: commandContent,
				source,
				filePath: resolvedPath,
				description,
				argumentHint,
				mode,
			})
		}
	} catch (error) {
		console.warn(`[jabberwock] Failed to read command file ${resolvedPath}:`, error)
	}
}

/**
 * Extract command name from filename (strip .md extension only)
 */
export function getCommandNameFromFile(filename: string): string {
	if (filename.toLowerCase().endsWith(".md")) {
		return filename.slice(0, -3)
	}
	return filename
}

/**
 * Check if a file is a markdown file
 */
export function isMarkdownFile(filename: string): boolean {
	const result = filename.toLowerCase().endsWith(".md")
	return result
}
