import * as nodePath from "path"
import { Volume, createFsFromVolume } from "memfs"
import * as fs from "fs"

const VIRTUAL_WORKSPACE_BRAND = Symbol("virtualWorkspace")

/**
 * VirtualWorkspace — in-memory filesystem (memfs) with a fallback to the
 * real filesystem for paths that exist on disk.
 */
export function VirtualWorkspace() {
	const vol = new Volume()
	const mfs = createFsFromVolume(vol)

	function readFromMemfs<T>(path: string, encoding?: string): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const cb = (err: Error | null | undefined, data?: string | Buffer) => {
				if (err) reject(err)
				else resolve(data as T)
			}
			if (encoding) {
				;(
					mfs.readFile as (
						path: string,
						encoding: string,
						cb: (err: Error | null | undefined, data?: string | Buffer) => void,
					) => void
				)(path, encoding, cb)
			} else {
				;(mfs.readFile as (path: string, cb: (err: Error | null | undefined, data?: Buffer) => void) => void)(
					path,
					cb,
				)
			}
		})
	}

	async function readdir(path?: string, options?: { withFileTypes?: false | undefined }): Promise<string[]>
	async function readdir(path?: string, options?: { withFileTypes: true }): Promise<fs.Dirent[]>
	async function readdir(path = "", options?: { withFileTypes?: boolean }): Promise<string[] | fs.Dirent[]> {
		try {
			if (options?.withFileTypes) {
				return await fs.promises.readdir(path, { withFileTypes: true })
			}
			return await fs.promises.readdir(path)
		} catch {
			return new Promise<string[] | fs.Dirent[]>((resolve, reject) => {
				;(
					mfs.readdir as (
						path: string,
						options: { withFileTypes: boolean },
						cb: (err: Error | null | undefined, entries?: string[] | fs.Dirent[]) => void,
					) => void
				)(path, { withFileTypes: true }, (err, entries) => {
					if (err) reject(err)
					else resolve(entries!)
				})
			})
		}
	}

	return {
		[VIRTUAL_WORKSPACE_BRAND]: true,
		vol,

		async writeFile(path = "", content: string | Buffer | Uint8Array = "", _encoding?: string) {
			return new Promise((resolve, reject) => {
				vol.writeFile(path, content, (err) => (err ? reject(err) : resolve(true)))
			})
		},

		async readFile(path = "", _encoding?: string): Promise<string> {
			try {
				return await fs.promises.readFile(path, "utf-8")
			} catch {
				return readFromMemfs<string>(path, "utf8") as Promise<string>
			}
		},

		async readBuffer(path = ""): Promise<Buffer> {
			try {
				return await fs.promises.readFile(path)
			} catch {
				return readFromMemfs<Buffer>(path) as Promise<Buffer>
			}
		},

		readdir,

		async unlink(path = ""): Promise<boolean> {
			return new Promise((resolve, reject) => {
				vol.unlink(path, (err) => (err ? reject(err) : resolve(true)))
			})
		},

		async mkdir(path = "", _options?: { [key: string]: unknown } | string): Promise<boolean> {
			return new Promise((resolve, reject) => {
				vol.mkdir(path, { recursive: true }, (err) => (err ? reject(err) : resolve(true)))
			})
		},

		async rmdir(path = ""): Promise<boolean> {
			return new Promise((resolve, reject) => {
				vol.rmdir(path, (err) => (err ? reject(err) : resolve(true)))
			})
		},

		async stat(path = ""): Promise<fs.Stats> {
			try {
				return await fs.promises.stat(path)
			} catch {
				return new Promise<fs.Stats>((resolve, reject) => {
					;(
						mfs.stat as (
							path: string,
							cb: (err: Error | null | undefined, stats?: fs.Stats) => void,
						) => void
					)(path, (err, stats) => {
						if (err) reject(err)
						else resolve(stats!)
					})
				})
			}
		},

		async access(path = ""): Promise<void> {
			try {
				return await fs.promises.access(path)
			} catch {
				return new Promise<void>((resolve, reject) => {
					mfs.access(path, (err: Error | null | undefined) => {
						if (err) reject(err)
						else resolve()
					})
				})
			}
		},

		rollback() {
			vol.reset()
		},

		async commitToDisk(basePath: string) {
			const files = vol.toJSON()
			const writePromises = Object.entries(files).map(async ([filePath, content]) => {
				if (content !== null) {
					const targetPath = nodePath.isAbsolute(filePath) ? filePath : nodePath.join(basePath, filePath)
					await fs.promises.mkdir(nodePath.dirname(targetPath), { recursive: true })
					return fs.promises.writeFile(targetPath, content as string)
				}
				return Promise.resolve()
			})
			await Promise.all(writePromises)
			vol.reset()
		},
	}
}

/** VirtualWorkspace instance type */
export type VirtualWorkspace = ReturnType<typeof VirtualWorkspace>

/** Type guard replacing `instanceof VirtualWorkspace` (factory has no prototype). */
export function isVirtualWorkspace(value: unknown): value is VirtualWorkspace {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as Record<PropertyKey, unknown>)[VIRTUAL_WORKSPACE_BRAND] === true
	)
}

export const virtualWorkspace = VirtualWorkspace()
