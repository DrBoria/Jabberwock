import * as fs from "fs"
import * as path from "path"

import { TERMINAL_PREVIEW_BYTES, PersistedCommandOutput } from "@jabberwock/types"

import { OutputInterceptorOptions } from "./OutputInterceptor.types"
import { PreviewBuffer } from "./OutputInterceptor.buffer"
import { cleanupOutputArtifacts, cleanupOutputArtifactsByIds } from "./OutputInterceptor.cleanup"

export type { OutputInterceptorOptions }

export class OutputInterceptor {
	private readonly previewBuffer: PreviewBuffer
	private pendingChunks: string[] = []
	private writeStream: fs.WriteStream | null = null
	private readonly artifactPath: string
	private totalBytes: number = 0
	private spilledToDisk: boolean = false
	private readonly previewBytes: number

	constructor(private readonly options: OutputInterceptorOptions) {
		this.previewBytes = TERMINAL_PREVIEW_BYTES[options.previewSize]
		this.previewBuffer = new PreviewBuffer(this.previewBytes)
		this.artifactPath = path.join(options.storageDir, `cmd-${options.executionId}.txt`)
	}

	write(chunk: string): void {
		const chunkBytes = Buffer.byteLength(chunk, "utf8")
		this.totalBytes += chunkBytes
		this.previewBuffer.add(chunk)

		if (!this.spilledToDisk) {
			this.pendingChunks.push(chunk)

			if (this.totalBytes > this.previewBytes) {
				this.spillToDisk()
			}
		} else {
			this.writeStream?.write(chunk)
		}
	}

	private spillToDisk(): void {
		const dir = path.dirname(this.artifactPath)
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true })
		}

		this.writeStream = fs.createWriteStream(this.artifactPath)

		for (const chunk of this.pendingChunks) {
			this.writeStream.write(chunk)
		}

		this.pendingChunks = []
		this.spilledToDisk = true
	}

	async finalize(): Promise<PersistedCommandOutput> {
		if (this.writeStream) {
			await new Promise<void>((resolve, reject) => {
				this.writeStream!.end(() => resolve())
				this.writeStream!.on("error", reject)
			})
		}

		return {
			preview: this.previewBuffer.getPreview(),
			totalBytes: this.totalBytes,
			artifactPath: this.spilledToDisk ? this.artifactPath : null,
			truncated: this.spilledToDisk,
		}
	}

	getBufferForUI(): string {
		return this.previewBuffer.getBuffer()
	}

	getArtifactPath(): string {
		return this.artifactPath
	}

	hasSpilledToDisk(): boolean {
		return this.spilledToDisk
	}

	static async cleanup(storageDir: string): Promise<void> {
		return cleanupOutputArtifacts(storageDir)
	}

	static async cleanupByIds(storageDir: string, executionIds: Set<string>): Promise<void> {
		return cleanupOutputArtifactsByIds(storageDir, executionIds)
	}
}
