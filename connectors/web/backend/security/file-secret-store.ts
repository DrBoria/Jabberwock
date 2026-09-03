import * as fs from "node:fs"
import * as path from "node:path"
import type { ISecretStore } from "../../../../packages/types/src/protocol/backend-connector.ts"

/**
 * v4 Phase C1 (§4.3): file-backed secret store for standalone server mode.
 *
 * Reads an environment override first (Docker-friendly, plan §9.4), then falls back to a
 * JSON file under `--data-dir` written with 0600 permissions.
 */
export class FileSecretStore implements ISecretStore {
	private readonly secretsPath: string
	private readonly cache = new Map<string, string>()

	constructor(
		dataDir: string,
		private readonly env?: Record<string, string | undefined>,
	) {
		this.secretsPath = path.join(dataDir, "secrets.json")
		this.load()
	}

	private load(): void {
		try {
			const raw = JSON.parse(fs.readFileSync(this.secretsPath, "utf8")) as Record<string, string>
			for (const [key, value] of Object.entries(raw)) this.cache.set(key, value)
		} catch {
			// no secrets file exists yet
		}
	}

	private save(): void {
		fs.writeFileSync(this.secretsPath, JSON.stringify(Object.fromEntries(this.cache), null, 2), {
			encoding: "utf8",
			mode: 0o600,
		})
	}

	async get(key: string): Promise<string | undefined> {
		const envValue = this.env?.[key]
		if (envValue !== undefined) return envValue
		return this.cache.get(key)
	}

	async store(key: string, value: string): Promise<void> {
		this.cache.set(key, value)
		this.save()
	}

	async delete(key: string): Promise<boolean> {
		const existed = this.cache.delete(key)
		if (existed) this.save()
		return existed
	}
}
