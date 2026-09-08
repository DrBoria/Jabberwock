import * as fs from "node:fs"
import * as path from "node:path"
import type { IConfiguration } from "../../../../packages/types/src/protocol/backend-connector.ts"

/**
 * v4 Phase D4b (plan §3.2 Strategy B): pure-Node configuration source for standalone server mode.
 *
 * Backs the `IConfiguration` capability slot without any host dependency:
 *   - Primary source: a JSON file under `--data-dir` (`config.json`), structured as
 *     `{ "<section>": { "<key>": <value> } }`.
 *   - When the file is absent (first run) or a key is unset, `get` returns the caller's
 *     `defaultValue` — matching the vscode `workspace.getConfiguration().get(key, default)` surface.
 *
 * The read path is synchronous (matches the vscode sync `get` and the sync consumers in provider
 * constructors); the write path persists to the JSON file (file-based fallback for `update`).
 */
export class ServerConfiguration implements IConfiguration {
	private readonly filePath: string
	private readonly values: Map<string, unknown> = new Map()

	constructor(dataDir: string) {
		this.filePath = path.join(dataDir, "config.json")
		this.loadFile()
	}

	get<T>(section: string, key: string, defaultValue?: T): T | undefined {
		const value = this.values.get(this.compositeKey(section, key))
		return value === undefined ? defaultValue : (value as T)
	}

	async update(section: string, key: string, value: unknown): Promise<void> {
		this.values.set(this.compositeKey(section, key), value)
		this.persist()
	}

	private compositeKey(section: string, key: string): string {
		// NUL separator: section/key names never contain it, so the composite is unambiguous.
		return `${section}\u0000${key}`
	}

	private loadFile(): void {
		try {
			const raw = fs.readFileSync(this.filePath, "utf-8")
			const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>
			for (const [section, entries] of Object.entries(parsed)) {
				if (entries && typeof entries === "object") {
					for (const [key, value] of Object.entries(entries)) {
						this.values.set(this.compositeKey(section, key), value)
					}
				}
			}
		} catch {
			// No config file yet (first run) or unreadable — start empty; callers fall back to defaults.
		}
	}

	private persist(): void {
		const nested: Record<string, Record<string, unknown>> = {}
		for (const [composite, value] of this.values) {
			const idx = composite.indexOf("\u0000")
			const section = composite.slice(0, idx)
			const key = composite.slice(idx + 1)
			;(nested[section] ??= {})[key] = value
		}
		try {
			fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
			fs.writeFileSync(this.filePath, `${JSON.stringify(nested, null, 2)}\n`, "utf-8")
		} catch {
			// Persistence is best-effort in server mode; the in-memory map stays authoritative for reads.
		}
	}
}
