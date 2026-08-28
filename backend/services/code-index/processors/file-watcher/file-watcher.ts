import * as vscode from "vscode"
import type { IExtensionContextView } from "@features/foundation/vscode/context"
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
import { TelemetryEventName } from "@jabberwock/types"
import { sanitizeErrorMessage } from "@services/code-index/shared/sanitizeInput"
import { Package } from "@shared/package"
import { Ignore } from "ignore"
import { BatchContext } from "./batch/helpers.types"
import { processFile } from "./file-watcher.process"
import { processBatch } from "./batch/file-watcher.batch"

export class FileWatcher implements IFileWatcher {
	private ignoreInstance?: Ignore
	private fileWatcher?: vscode.FileSystemWatcher
	private ignorePatterns: string | undefined
	private accumulatedEvents: Map<string, { uri: vscode.Uri; type: "create" | "change" | "delete" }> = new Map()
	private batchProcessDebounceTimer?: NodeJS.Timeout
	private readonly BATCH_DEBOUNCE_DELAY_MS = 500
	private readonly FILE_PROCESSING_CONCURRENCY_LIMIT = 10
	private readonly batchSegmentThreshold: number

	private readonly _onDidStartBatchProcessing = new vscode.EventEmitter<string[]>()
	private readonly _onBatchProgressUpdate = new vscode.EventEmitter<{
		processedInBatch: number
		totalInBatch: number
		currentFile?: string
	}>()
	private readonly _onDidFinishBatchProcessing = new vscode.EventEmitter<BatchProcessingSummary>()

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
				this.batchSegmentThreshold = vscode.workspace
					.getConfiguration(Package.name)
					.get<number>("codeIndex.embeddingBatchSize", BATCH_SEGMENT_THRESHOLD)
			} catch {
				this.batchSegmentThreshold = BATCH_SEGMENT_THRESHOLD
			}
		}
	}

	async initialize(): Promise<void> {
		const filePattern = new vscode.RelativePattern(
			this.workspacePath,
			`**/*{${scannerExtensions.map((e) => e.substring(1)).join(",")}}`,
		)
		this.fileWatcher = vscode.workspace.createFileSystemWatcher(filePattern)
		this.fileWatcher.onDidCreate(this.handleFileCreated.bind(this))
		this.fileWatcher.onDidChange(this.handleFileChanged.bind(this))
		this.fileWatcher.onDidDelete(this.handleFileDeleted.bind(this))
	}

	dispose(): void {
		this.fileWatcher?.dispose()
		if (this.batchProcessDebounceTimer) {
			clearTimeout(this.batchProcessDebounceTimer)
		}
		this._onDidStartBatchProcessing.dispose()
		this._onBatchProgressUpdate.dispose()
		this._onDidFinishBatchProcessing.dispose()
		this.accumulatedEvents.clear()
	}

	private async handleFileCreated(uri: vscode.Uri): Promise<void> {
		this.accumulatedEvents.set(uri.fsPath, { uri, type: "create" })
		this.scheduleBatchProcessing()
	}

	private async handleFileChanged(uri: vscode.Uri): Promise<void> {
		this.accumulatedEvents.set(uri.fsPath, { uri, type: "change" })
		this.scheduleBatchProcessing()
	}

	private async handleFileDeleted(uri: vscode.Uri): Promise<void> {
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
