import { Volume, createFsFromVolume } from "memfs"
import { Union } from "unionfs"
import * as fs from "fs"

export class VirtualWorkspace {
	vol = new Volume()
	overlayFs = new Union()

	constructor() {
		this.overlayFs.use(createFsFromVolume(this.vol) as any)
		this.overlayFs.use(fs as any)
	}

	async writeFile(path = "", content: string | Buffer | Uint8Array = "", _encoding?: string) {
		return new Promise((resolve, reject) => {
			this.vol.writeFile(path, content, (err) => (err ? reject(err) : resolve(true)))
		})
	}

	async readFile(path = "", _encoding?: string): Promise<string> {
		return new Promise((resolve, reject) => {
			this.overlayFs.readFile(path, "utf8", (err, data) => (err ? reject(err) : resolve(data as string)))
		})
	}

	async readBuffer(path = ""): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			this.overlayFs.readFile(path, (err, data) => (err ? reject(err) : resolve(data as Buffer)))
		})
	}

	async unlink(path = ""): Promise<boolean> {
		return new Promise((resolve, reject) => {
			this.vol.unlink(path, (err) => (err ? reject(err) : resolve(true)))
		})
	}

	async mkdir(path = "", _options?: any): Promise<boolean> {
		return new Promise((resolve, reject) => {
			this.vol.mkdir(path, { recursive: true }, (err) => (err ? reject(err) : resolve(true)))
		})
	}

	async rmdir(path = ""): Promise<boolean> {
		return new Promise((resolve, reject) => {
			this.vol.rmdir(path, (err) => (err ? reject(err) : resolve(true)))
		})
	}

	async stat(path = ""): Promise<fs.Stats> {
		return new Promise((resolve, reject) => {
			this.overlayFs.stat(path, (err, stats) => (err ? reject(err) : resolve(stats as fs.Stats)))
		})
	}

	async readdir(path = "", options?: { withFileTypes?: boolean }): Promise<any[]> {
		return new Promise((resolve, reject) => {
			this.overlayFs.readdir(path, options as any, (err, entries) =>
				err ? reject(err) : resolve(entries as any[]),
			)
		})
	}

	async access(path = ""): Promise<void> {
		return new Promise((resolve, reject) => {
			this.overlayFs.access(path, (err) => (err ? reject(err) : resolve()))
		})
	}

	rollback() {
		this.vol.reset()
	}

	async commitToDisk(basePath: string) {
		const files = this.vol.toJSON()
		const writePromises = Object.entries(files).map(async ([filePath, content]) => {
			if (content !== null) {
				const path = await import("path")
				const targetPath = path.isAbsolute(filePath) ? filePath : path.join(basePath, filePath)
				await fs.promises.mkdir(path.dirname(targetPath), { recursive: true })
				return fs.promises.writeFile(targetPath, content as string)
			}
			return Promise.resolve()
		})
		await Promise.all(writePromises)
		this.vol.reset()
	}
}

export const virtualWorkspace = new VirtualWorkspace()
