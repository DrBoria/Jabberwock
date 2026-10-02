import type { IExtensionContextView } from "@features/foundation/host-context/context"
import { BATCH_SEGMENT_THRESHOLD } from "@services/code-index/constants"
import { scannerExtensions } from "@services/code-index/shared/supported-extensions"
import { FileProcessingResult, IEmbedder, IVectorStore, BatchProcessingSummary } from "@services/code-index/interfaces"
import { CacheManager } from "@services/code-index/cache-manager"
import { getTelemetryService } from "@jabberwock/telemetry"
import { TelemetryEventName, type IUri, type IFileWatcher as IHostFileWatcher } from "@jabberwock/types"
import { sanitizeErrorMessage } from "@services/code-index/shared/sanitizeInput"
import { Package } from "@shared/core/package"
import { Ignore } from "ignore"
import { BatchContext } from "./batch/helpers-types"
import { processFile } from "./process"
import { processBatch } from "./batch/file-watcher-batch"
import { EventEmitter } from "@features/foundation"
import { getFileWatchers, getConfiguration } from "@features/foundation"

export function FileWatcher(
	workspacePath: string,
	context: IExtensionContextView,
	cacheManager: CacheManager,
	embedder?: IEmbedder,
	vectorStore?: IVectorStore,
	ignoreInstance?: Ignore,
	ignorePatterns?: string,
	batchSegmentThreshold?: number,
) {
	let accumulatedEvents: Map<string, { uri: IUri; type: "create" | "change" | "delete" }> = new Map()
	let BATCH_DEBOUNCE_DELAY_MS = 500
	let FILE_PROCESSING_CONCURRENCY_LIMIT = 10
	let _onDidStartBatchProcessing = new EventEmitter<string[]>()
	let _onBatchProgressUpdate = new EventEmitter<{
		processedInBatch: number
		totalInBatch: number
		currentFile?: string
	}>()
	let _onDidFinishBatchProcessing = new EventEmitter<BatchProcessingSummary>()
	let onDidStartBatchProcessing = _onDidStartBatchProcessing.event
	let onBatchProgressUpdate = _onBatchProgressUpdate.event
	let onDidFinishBatchProcessing = _onDidFinishBatchProcessing.event
	if (ignoreInstance) {
	}
	if (batchSegmentThreshold !== undefined) {
	} else {
		try {
			// D4g-2 (batch 3): config read via the capability slot (D4b).
			batchSegmentThreshold =
				getConfiguration().get<number>(Package.name, "codeIndex.embeddingBatchSize", BATCH_SEGMENT_THRESHOLD) ??
				BATCH_SEGMENT_THRESHOLD
		} catch {
			batchSegmentThreshold = BATCH_SEGMENT_THRESHOLD
		}
	}

	const handler = {
		get batchContext(): BatchContext {
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
		},
		ignoreInstance,
		fileWatcher: undefined as IHostFileWatcher | undefined,
		ignorePatterns,
		accumulatedEvents: accumulatedEvents,
		batchProcessDebounceTimer: undefined as NodeJS.Timeout | undefined,
		BATCH_DEBOUNCE_DELAY_MS: BATCH_DEBOUNCE_DELAY_MS,
		FILE_PROCESSING_CONCURRENCY_LIMIT: FILE_PROCESSING_CONCURRENCY_LIMIT,
		batchSegmentThreshold: batchSegmentThreshold,
		_onDidStartBatchProcessing: _onDidStartBatchProcessing,
		_onBatchProgressUpdate: _onBatchProgressUpdate,
		_onDidFinishBatchProcessing: _onDidFinishBatchProcessing,
		onDidStartBatchProcessing: onDidStartBatchProcessing,
		onBatchProgressUpdate: onBatchProgressUpdate,
		onDidFinishBatchProcessing: onDidFinishBatchProcessing,
		workspacePath,
		context,
		cacheManager,
		embedder,
		vectorStore,
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
			handler.fileWatcher = await factory.watch([filePattern], { cwd: handler.workspacePath })
			handler.fileWatcher.onCreate?.((filePath) => {
				void handler.handleFileCreated({ fsPath: filePath })
			})
			handler.fileWatcher.onChange?.((filePath) => {
				void handler.handleFileChanged({ fsPath: filePath })
			})
			handler.fileWatcher.onDelete?.((filePath) => {
				void handler.handleFileDeleted({ fsPath: filePath })
			})
		},
		dispose(): void {
			handler.fileWatcher?.close()
			handler.fileWatcher?.dispose()
			if (handler.batchProcessDebounceTimer) {
				clearTimeout(handler.batchProcessDebounceTimer)
			}
			handler._onDidStartBatchProcessing.dispose()
			handler._onBatchProgressUpdate.dispose()
			handler._onDidFinishBatchProcessing.dispose()
			handler.accumulatedEvents.clear()
		},
		async handleFileCreated(uri: IUri): Promise<void> {
			handler.accumulatedEvents.set(uri.fsPath, { uri, type: "create" })
			handler.scheduleBatchProcessing()
		},
		async handleFileChanged(uri: IUri): Promise<void> {
			handler.accumulatedEvents.set(uri.fsPath, { uri, type: "change" })
			handler.scheduleBatchProcessing()
		},
		async handleFileDeleted(uri: IUri): Promise<void> {
			handler.accumulatedEvents.set(uri.fsPath, { uri, type: "delete" })
			handler.scheduleBatchProcessing()
		},
		scheduleBatchProcessing(): void {
			if (handler.batchProcessDebounceTimer) {
				clearTimeout(handler.batchProcessDebounceTimer)
			}
			handler.batchProcessDebounceTimer = setTimeout(
				() => handler.triggerBatchProcessing(),
				handler.BATCH_DEBOUNCE_DELAY_MS,
			)
		},
		async triggerBatchProcessing(): Promise<void> {
			if (handler.accumulatedEvents.size === 0) {
				return
			}
			const eventsToProcess = new Map(handler.accumulatedEvents)
			handler.accumulatedEvents.clear()
			const filePathsInBatch = Array.from(eventsToProcess.keys())
			handler._onDidStartBatchProcessing.fire(filePathsInBatch)
			await processBatch(
				eventsToProcess,
				handler.batchContext,
				handler._onBatchProgressUpdate,
				handler._onDidFinishBatchProcessing,
				handler.accumulatedEvents,
			)
		},
		async processFile(filePath: string): Promise<FileProcessingResult> {
			return processFile(
				filePath,
				handler.workspacePath,
				handler.cacheManager,
				handler.ignorePatterns,
				handler.ignoreInstance,
				handler.embedder,
			)
		},
	}
	return handler
}
