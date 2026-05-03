/**
 * CommandRegistry — Parses VS Code extension package.json to discover contributed commands.
 *
 * Reads `contributes.commands` from an extension's package.json and makes
 * them available as typed command descriptors. Supports lookup by full ID
 * (e.g., "jabberwock.historyButtonClicked") or short name (e.g., "historyButtonClicked").
 *
 * This eliminates the need to hardcode command strings in tests — the
 * package.json is the single source of truth.
 *
 * Usage:
 *   const registry = new CommandRegistry()
 *   registry.load("src/package.json")
 *   const cmd = registry.get("historyButtonClicked")
 *   // cmd.id === "jabberwock.historyButtonClicked"
 */

import { readFileSync, existsSync } from "fs"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtensionCommand {
	/** Full command ID, e.g. "jabberwock.historyButtonClicked" */
	id: string
	/** Short name (last segment after dot), e.g. "historyButtonClicked" */
	name: string
	/** Display title (may use %localize.key% format) */
	title: string
	/** Optional category */
	category?: string
}

// ── Registry ──────────────────────────────────────────────────────────────────

export class CommandRegistry {
	/** Map keyed by both full ID and short name */
	private commands = new Map<string, ExtensionCommand>()
	private loaded = false

	/**
	 * Load commands from an extension's package.json.
	 *
	 * @param packageJsonPath - Path to the extension's package.json
	 *                          (relative to process.cwd() or absolute).
	 *                          Default: "./src/package.json"
	 */
	load(packageJsonPath?: string): void {
		const resolvedPath = packageJsonPath || "./src/package.json"

		if (!existsSync(resolvedPath)) {
			console.warn(`[CommandRegistry] package.json not found at: ${resolvedPath}`)
			return
		}

		const raw = readFileSync(resolvedPath, "utf-8")
		let pkg: Record<string, unknown>
		try {
			pkg = JSON.parse(raw)
		} catch {
			console.warn(`[CommandRegistry] Failed to parse: ${resolvedPath}`)
			return
		}

		const contributes = pkg.contributes as Record<string, unknown> | undefined
		const rawCommands = (contributes?.commands || []) as Array<{
			command?: string
			title?: string
			category?: string
		}>

		for (const entry of rawCommands) {
			if (!entry.command) continue

			// Extract short name: "jabberwock.historyButtonClicked" → "historyButtonClicked"
			const dotIndex = entry.command.lastIndexOf(".")
			const name = dotIndex >= 0 ? entry.command.slice(dotIndex + 1) : entry.command

			const descriptor: ExtensionCommand = {
				id: entry.command,
				name,
				title: entry.title || name,
				category: entry.category,
			}

			// Register by full ID
			this.commands.set(entry.command, descriptor)
			// Register by short name (last unique wins if ambiguous)
			this.commands.set(name, descriptor)
		}

		this.loaded = true
		const uniqueCount = new Set(Array.from(this.commands.values()).map((c) => c.id)).size
		console.log(`[CommandRegistry] Loaded ${uniqueCount} commands from ${resolvedPath}`)
	}

	/**
	 * Get a command descriptor by full ID or short name.
	 * Returns undefined if not found.
	 */
	get(idOrName: string): ExtensionCommand | undefined {
		return this.commands.get(idOrName)
	}

	/**
	 * Resolve a short name or partial ID to its full command ID.
	 * E.g., "historyButtonClicked" → "jabberwock.historyButtonClicked"
	 */
	resolveId(idOrName: string): string | undefined {
		return this.commands.get(idOrName)?.id
	}

	/**
	 * Get all unique commands (deduplicated by ID).
	 */
	getAll(): ExtensionCommand[] {
		const seen = new Set<string>()
		return Array.from(this.commands.values()).filter((cmd) => {
			if (seen.has(cmd.id)) return false
			seen.add(cmd.id)
			return true
		})
	}

	/**
	 * Get all short names (e.g., "historyButtonClicked", "settingsButtonClicked").
	 */
	getCommandNames(): string[] {
		return this.getAll().map((c) => c.name)
	}

	/**
	 * Get all full command IDs (e.g., "jabberwock.historyButtonClicked").
	 */
	getCommandIds(): string[] {
		return this.getAll().map((c) => c.id)
	}

	/**
	 * Check if a command with the given ID or short name is registered.
	 */
	has(idOrName: string): boolean {
		return this.commands.has(idOrName)
	}

	/**
	 * Whether commands have been loaded.
	 */
	isLoaded(): boolean {
		return this.loaded
	}
}
