import fs from "fs/promises"
import * as path from "path"
import { Dirent } from "fs"
import matter from "gray-matter"

/**
 * Maximum depth for resolving symlinks to prevent cyclic symlink loops
 */
const MAX_DEPTH = 5

/**
 * Information about a resolved command file
 */
export interface CommandFileInfo {
	/** Original path (symlink path if symlinked, otherwise the file path) */
	originalPath: string
	/** Resolved path (target of symlink if symlinked, otherwise the file path) */
	resolvedPath: string
}

function isMarkdownFile(filename: string): boolean {
	return filename.toLowerCase().endsWith(".md")
}

/**
 * Recursively resolve a symbolic link and collect command file info
 */
export async function resolveCommandSymLink(
	symlinkPath: string,
	fileInfo: CommandFileInfo[],
	depth: number,
): Promise<void> {
	// Avoid cyclic symlinks
	if (depth > MAX_DEPTH) {
		return
	}
	try {
		// Get the symlink target
		const linkTarget = await fs.readlink(symlinkPath)
		// Resolve the target path (relative to the symlink location)
		const resolvedTarget = path.resolve(path.dirname(symlinkPath), linkTarget)

		// Check if the target is a file (use lstat to detect nested symlinks)
		const stats = await fs.lstat(resolvedTarget)
		if (stats.isFile()) {
			// Only include markdown files
			if (isMarkdownFile(resolvedTarget)) {
				// For symlinks to files, store the symlink path as original and target as resolved
				fileInfo.push({ originalPath: symlinkPath, resolvedPath: resolvedTarget })
			}
		} else if (stats.isDirectory()) {
			// Read the target directory and process its entries
			const entries = await fs.readdir(resolvedTarget, { withFileTypes: true })
			const directoryPromises: Promise<void>[] = []
			for (const entry of entries) {
				directoryPromises.push(resolveCommandDirectoryEntry(entry, resolvedTarget, fileInfo, depth + 1))
			}
			await Promise.all(directoryPromises)
		} else if (stats.isSymbolicLink()) {
			// Handle nested symlinks
			await resolveCommandSymLink(resolvedTarget, fileInfo, depth + 1)
		}
	} catch {
		// Skip invalid symlinks
	}
}

/**
 * Recursively resolve directory entries and collect command file paths
 */
export async function resolveCommandDirectoryEntry(
	entry: Dirent,
	dirPath: string,
	fileInfo: CommandFileInfo[],
	depth: number,
): Promise<void> {
	// Avoid cyclic symlinks
	if (depth > MAX_DEPTH) {
		return
	}

	const fullPath = path.resolve(entry.parentPath || dirPath, entry.name)
	if (entry.isFile()) {
		// Only include markdown files
		if (isMarkdownFile(entry.name)) {
			// Regular file - both original and resolved paths are the same
			fileInfo.push({ originalPath: fullPath, resolvedPath: fullPath })
		}
	} else if (entry.isSymbolicLink()) {
		// Await the resolution of the symbolic link
		await resolveCommandSymLink(fullPath, fileInfo, depth + 1)
	}
}

/**
 * Try to resolve a symlinked command file
 */
export async function tryResolveSymlinkedCommand(filePath: string): Promise<string | undefined> {
	try {
		const lstat = await fs.lstat(filePath)
		if (lstat.isSymbolicLink()) {
			// Get the symlink target
			const linkTarget = await fs.readlink(filePath)
			// Resolve the target path (relative to the symlink location)
			const resolvedTarget = path.resolve(path.dirname(filePath), linkTarget)

			// Check if the target is a file
			const stats = await fs.stat(resolvedTarget)
			if (stats.isFile()) {
				return resolvedTarget
			}
		}
	} catch {
		// Not a symlink or invalid symlink
	}
	return undefined
}

/**
 * Try to load a specific command from a directory (supports symlinks)
 */
export async function tryLoadCommand(
	dirPath: string,
	name: string,
	source: "global" | "project",
	loadCommandContent: (
		dirPath: string,
		name: string,
	) => Promise<{ resolvedPath: string; content: string } | undefined>,
	parseFrontmatter: (content: string) => {
		description: string | undefined
		argumentHint: string | undefined
		mode: string | undefined
		commandContent: string
	},
): Promise<
	| {
			name: string
			content: string
			source: "global" | "project"
			filePath: string
			description?: string
			argumentHint?: string
			mode?: string
	  }
	| undefined
> {
	try {
		const stats = await fs.stat(dirPath)
		if (!stats.isDirectory()) {
			return undefined
		}

		const resolvedInfo = await loadCommandContent(dirPath, name)
		if (!resolvedInfo) {
			return undefined
		}

		const { resolvedPath, content } = resolvedInfo
		const { description, argumentHint, mode, commandContent } = parseFrontmatter(content)

		return {
			name,
			content: commandContent,
			source,
			filePath: resolvedPath,
			description,
			argumentHint,
			mode,
		}
	} catch {
		return undefined
	}
}

export async function tryReadCommandFile(
	dirPath: string,
	name: string,
): Promise<{ resolvedPath: string; content: string } | undefined> {
	const commandFileName = `${name}.md`
	const filePath = path.join(dirPath, commandFileName)

	try {
		const content = await fs.readFile(filePath, "utf-8")
		return { resolvedPath: filePath, content }
	} catch {
		const symlinkedPath = await tryResolveSymlinkedCommand(filePath)
		if (!symlinkedPath) {
			return undefined
		}
		try {
			const content = await fs.readFile(symlinkedPath, "utf-8")
			return { resolvedPath: symlinkedPath, content }
		} catch {
			return undefined
		}
	}
}

export function parseCommandFrontmatter(content: string): {
	description: string | undefined
	argumentHint: string | undefined
	mode: string | undefined
	commandContent: string
} {
	try {
		const parsed = matter(content)
		const description =
			typeof parsed.data.description === "string" && parsed.data.description.trim()
				? parsed.data.description.trim()
				: undefined
		const argumentHint =
			typeof parsed.data["argument-hint"] === "string" && parsed.data["argument-hint"].trim()
				? parsed.data["argument-hint"].trim()
				: undefined
		const mode =
			typeof parsed.data.mode === "string" && parsed.data.mode.trim() ? parsed.data.mode.trim() : undefined
		const commandContent = parsed.content.trim()
		return { description, argumentHint, mode, commandContent }
	} catch {
		return {
			description: undefined,
			argumentHint: undefined,
			mode: undefined,
			commandContent: content.trim(),
		}
	}
}
