import type { IExtensionContextView } from "@features/foundation/host-context/context"
import { BATCH_SEGMENT_THRESHOLD } from "@services/code-index/constants"
import { scannerExtensions } from "@services/code-index/shared/supported-extensions"
import {
	IFileWatcher,
	FileProcessingResult,
	IEmbedder,
	IVectorStore,
	BatchProcessingSummary,
} from "@services/code-index/interfaces"
import { CacheManager } from "@services/code-index/cache-manager"
import { getTelemetryService } from "@jabberwock/telemetry"
import { TelemetryEventName, type IUri, type IFileWatcher as IHostFileWatcher } from "@jabberwock/types"
import { sanitizeErrorMessage } from "@services/code-index/shared/sanitizeInput"
import { Package } from "@shared/package"
import { Ignore } from "ignore"
import { BatchContext } from "./batch/helpers.types"
import { processFile } from "./file-watcher.process"
import { processBatch } from "./batch/file-watcher.batch"
import { EventEmitter } from "@features/foundation/events/event-emitter"
import { getFileWatchers, getConfiguration } from "@features/foundation/capabilities/registry"

export class FileWatcher implements IFileWatcher {
	private ignoreInstance?: Ignore
	// D4g-2 (batch 3): host-neutral file watcher (D4e fileWatchers slot) — the vscode connector
	// backs it with a real vscode.FileSystemWatcher; server mode backs it with chokidar.
	private fileWatcher?: IHostFileWatcher
	private ignorePatterns: string | undefined
	private accumulatedEvents: Map<string, { uri: IUri; type: "create" | "change" | "delete" }> = new Map()
	private batchProcessDebounceTimer?: NodeJS.Timeout
	private readonly BATCH_DEBOUNCE_DELAY_MS = 500
	private readonly FILE_PROCESSING_CONCURRENCY_LIMIT = 10
	private readonly batchSegmentThreshold: number

	// D4g-2 (batch 3): host-neutral event emitters (replaces vscode.EventEmitter).
	private readonly _onDidStartBatchProcessing = new EventEmitter<string[]>()
	private readonly _onBatchProgressUpdate = new EventEmitter<{
		processedInBatch: number
		totalInBatch: number
		currentFile?: string
	}>()
	private readonly _onDidFinishBatchProcessing = new EventEmitter<BatchProcessingSummary>()

	public readonly onDidStartBatchProcessing = this._onDidStartBatchProcessing.event
	public readonly onBatchProgressUpdate = this._onBatchProgressUpdate.event
	public readonly onDidFinishBatchProcessing = this._onDidFinishBatchProcessing.event

	private get batchContext(): BatchContext {
		return {
			cacheManager: this.cacheManager,
			vectorStore: this.vectorStore,
			embedder: this.embedder,
			workspacePath: this.workspacePath,
			batchSegmentThreshold: this.batchSegmentThreshold,
			fileProcessingConcurrencyLimit: this.FILE_PROCESSING_CONCURRENCY_LIMIT,
			onBatchProgressUpdate: this._onBatchProgressUpdate,
			processFile: (filePath: string) => this.processFile(filePath),
			captureError: (location: string, errorType: string, extra?: Record<string, unknown>) => {
				getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: sanitizeErrorMessage(String(extra?.error ?? errorType)),
					location,
					errorType,
					...extra,
				})
			},
		}
	}

	constructor(
		private workspacePath: string,
		/** v4 B2 (L3): structural context view — real host contexts satisfy it structurally. */
		private context: IExtensionContextView,
		private readonly cacheManager: CacheManager,
		private embedder?: IEmbedder,
		private vectorStore?: IVectorStore,
		ignoreInstance?: Ignore,
		ignorePatterns?: string,
		batchSegmentThreshold?: number,
	) {
		this.ignorePatterns = ignorePatterns
		if (ignoreInstance) {
			this.ignoreInstance = ignoreInstance
		}
		if (batchSegmentThreshold !== undefined) {
			this.batchSegmentThreshold = batchSegmentThreshold
		} else {
			try {
				// D4g-2 (batch 3): config read via the capability slot (D4b).
				this.batchSegmentThreshold =
					getConfiguration().get<number>(
						Package.name,
						"codeIndex.embeddingBatchSize",
						BATCH_SEGMENT_THRESHOLD,
					) ?? BATCH_SEGMENT_THRESHOLD
			} catch {
				this.batchSegmentThreshold = BATCH_SEGMENT_THRESHOLD
			}
		}
	}

	async initialize(): Promise<void> {
		// D4g-2 (batch 3): host-neutral file watching via the D4e fileWatchers slot. The pattern is
		// an absolute path (workspace root + glob), which the vscode connector converts to a
		// RelativePattern and chokidar watches directly. Server mode without a watcher factory
		// degrades to no file watching (the code index still works for explicit scans).
		const factory = getFileWatchers()
		if (!factory) {
			return
		}
		// The glob is workspace-relative and anchored to the workspace root via the `cwd` option
		// (the vscode connector maps it to a RelativePattern; chokidar watches it under cwd).
		const filePattern = `**/*{${scannerExtensions.map((e) => e.substring(1)).join(",")}}`
		this.fileWatcher = await factory.watch([filePattern], { cwd: this.workspacePath })
		this.fileWatcher.onCreate?.((filePath) => {
			void this.handleFileCreated({ fsPath: filePath })
		})
		this.fileWatcher.onChange?.((filePath) => {
			void this.handleFileChanged({ fsPath: filePath })
		})
		this.fileWatcher.onDelete?.((filePath) => {
			void this.handleFileDeleted({ fsPath: filePath })
		})
	}

	dispose(): void {
		this.fileWatcher?.close()
		this.fileWatcher?.dispose()
		if (this.batchProcessDebounceTimer) {
			clearTimeout(this.batchProcessDebounceTimer)
		}
		this._onDidStartBatchProcessing.dispose()
		this._onBatchProgressUpdate.dispose()
		this._onDidFinishBatchProcessing.dispose()
		this.accumulatedEvents.clear()
	}

	private async handleFileCreated(uri: IUri): Promise<void> {
		this.accumulatedEvents.set(uri.fsPath, { uri, type: "create" })
		this.scheduleBatchProcessing()
	}

	private async handleFileChanged(uri: IUri): Promise<void> {
		this.accumulatedEvents.set(uri.fsPath, { uri, type: "change" })
		this.scheduleBatchProcessing()
	}

	private async handleFileDeleted(uri: IUri): Promise<void> {
		this.accumulatedEvents.set(uri.fsPath, { uri, type: "delete" })
		this.scheduleBatchProcessing()
	}

	private scheduleBatchProcessing(): void {
		if (this.batchProcessDebounceTimer) {
			clearTimeout(this.batchProcessDebounceTimer)
		}
		this.batchProcessDebounceTimer = setTimeout(() => this.triggerBatchProcessing(), this.BATCH_DEBOUNCE_DELAY_MS)
	}

	private async triggerBatchProcessing(): Promise<void> {
		if (this.accumulatedEvents.size === 0) {
			return
		}

		const eventsToProcess = new Map(this.accumulatedEvents)
		this.accumulatedEvents.clear()

		const filePathsInBatch = Array.from(eventsToProcess.keys())
		this._onDidStartBatchProcessing.fire(filePathsInBatch)

		await processBatch(
			eventsToProcess,
			this.batchContext,
			this._onBatchProgressUpdate,
			this._onDidFinishBatchProcessing,
			this.accumulatedEvents,
		)
	}

	async processFile(filePath: string): Promise<FileProcessingResult> {
		return processFile(
			filePath,
			this.workspacePath,
			this.cacheManager,
			this.ignorePatterns,
			this.ignoreInstance,
			this.embedder,
		)
	}
}
