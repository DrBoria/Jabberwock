import * as fs from "node:fs"
import * as path from "node:path"
import type { IHashmapMemory } from "../../../../packages/types/src/protocol/backend-connector.ts"

/**
 * v4 Phase C1 (§4.3): file-backed JSON hashmap memory for standalone server mode.
 *
 * Fills the `hashmapMemory` capability slot that vscode mode fills with
 * `ExtensionContext.globalState`. Each key maps to a JSON file under `--data-dir`;
 * writes are atomic (temp file + rename) so a crash cannot corrupt a value.
 *
 * Keys are sanitized to `[a-zA-Z0-9._-]` for safe file names; prefix scans run over
 * the sanitized names, which is lossless for the simple identifiers server consumers use.
 */
export class FileBackedHashmapMemory implements IHashmapMemory {
	private readonly dir: string

	constructor(dataDir: string) {
		this.dir = path.join(dataDir, "hashmap-memory")
		fs.mkdirSync(this.dir, { recursive: true })
	}

	private keyPath(key: string): string {
		const safe = key.replace(/[^a-zA-Z0-9._-]/g, "_")
		return path.join(this.dir, `${safe}.json`)
	}

	async get<T>(key: string): Promise<T | undefined> {
		try {
			const raw = await fs.promises.readFile(this.keyPath(key), "utf8")
			return JSON.parse(raw) as T
		} catch {
			return undefined
		}
	}

	async set(key: string, value: unknown): Promise<void> {
		const target = this.keyPath(key)
		const tmp = `${target}.${process.pid}.tmp`
		await fs.promises.writeFile(tmp, JSON.stringify(value), "utf8")
		await fs.promises.rename(tmp, target)
	}

	async delete(key: string): Promise<void> {
		try {
			await fs.promises.unlink(this.keyPath(key))
		} catch {
			// key did not exist — no-op
		}
	}

	async keys(prefix?: string): Promise<string[]> {
		const entries = await fs.promises.readdir(this.dir, { withFileTypes: true })
		return entries
			.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
			.map((entry) => entry.name.slice(0, -".json".length))
			.filter((key) => prefix === undefined || key.startsWith(prefix))
	}
}
