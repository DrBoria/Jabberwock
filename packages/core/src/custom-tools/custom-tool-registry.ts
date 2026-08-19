/**
 * CustomToolRegistry — dynamically loads, validates, and manages TypeScript tools.
 */

import os from "os"
import path from "path"
import fs from "fs"

import type { CustomToolDefinition, SerializedCustomToolDefinition } from "@jabberwock/types"

import type { StoredCustomTool } from "./types.ts"
import { serializeCustomTool } from "./serialize.ts"
import { validateToolDefinition } from "./custom-tool-registry-helpers.ts"
import { ToolDirectoryLoader } from "./custom-tool-registry-loader.ts"

export interface RegistryOptions {
	/** Directory for caching compiled TypeScript files. */
	cacheDir?: string
	/** Additional paths for resolving node modules (useful for tools outside node_modules). */
	nodePaths?: string[]
	/** Path to the extension root directory (for finding bundled esbuild binary in production). */
	extensionPath?: string
}

export class CustomToolRegistry {
	private tools = new Map<string, StoredCustomTool>()
	private cacheDir: string
	private nodePaths: string[]
	private extensionPath?: string
	private loader: ToolDirectoryLoader

	constructor(options?: RegistryOptions) {
		this.cacheDir = options?.cacheDir ?? path.join(os.tmpdir(), "dynamic-tools-cache")
		this.nodePaths = options?.nodePaths ?? [path.join(process.cwd(), "node_modules")]
		this.extensionPath = options?.extensionPath
		this.loader = new ToolDirectoryLoader(this.cacheDir, this.nodePaths, this.extensionPath, this.tools)
	}

	register(definition: CustomToolDefinition, source?: string): void {
		const validated = validateToolDefinition(definition.name, definition)

		if (!validated) {
			throw new Error(`Invalid tool definition for '${definition.name}'`)
		}

		const storedTool: StoredCustomTool = source ? { ...validated, source } : validated
		this.tools.set(definition.name, storedTool)
	}

	unregister(id: string): boolean {
		return this.tools.delete(id)
	}

	get(id: string): CustomToolDefinition | undefined {
		return this.tools.get(id)
	}

	has(id: string): boolean {
		return this.tools.has(id)
	}

	list(): string[] {
		return Array.from(this.tools.keys())
	}

	getAll(): CustomToolDefinition[] {
		return Array.from(this.tools.values())
	}

	getAllSerialized(): SerializedCustomToolDefinition[] {
		return this.getAll().map(serializeCustomTool)
	}

	get size(): number {
		return this.tools.size
	}

	clear(): void {
		this.tools.clear()
	}

	setExtensionPath(extensionPath: string): void {
		this.extensionPath = extensionPath
		this.loader.setExtensionPath(extensionPath)
	}

	getExtensionPath(): string | undefined {
		return this.extensionPath
	}

	clearCache(): void {
		if (fs.existsSync(this.cacheDir)) {
			try {
				const entries = fs.readdirSync(this.cacheDir, { withFileTypes: true })
				for (const entry of entries) {
					const entryPath = path.join(this.cacheDir, entry.name)
					if (entry.isDirectory()) {
						fs.rmSync(entryPath, { recursive: true, force: true })
					} else if (entry.name.endsWith(".mjs")) {
						fs.unlinkSync(entryPath)
					}
				}
			} catch (error) {
				console.error(
					`[CustomToolRegistry] clearCache failed to clean disk cache: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}
	}

	loadFromDirectory(toolDir: string) {
		return this.loader.loadFromDirectory(toolDir)
	}

	loadFromDirectoryIfStale(toolDir: string) {
		return this.loader.loadFromDirectoryIfStale(toolDir)
	}

	loadFromDirectories(toolDirs: string[]) {
		return this.loader.loadFromDirectories(toolDirs)
	}

	loadFromDirectoriesIfStale(toolDirs: string[]) {
		return this.loader.loadFromDirectoriesIfStale(toolDirs)
	}
}

export const customToolRegistry = new CustomToolRegistry()
