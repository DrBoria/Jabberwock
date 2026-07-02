import * as vscode from "vscode"
import { FileProcessingResult, IEmbedder, IVectorStore } from "@services/code-index/interfaces"
import { CacheManager } from "@services/code-index/cache-manager"

export interface BatchContext {
	cacheManager: CacheManager
	vectorStore?: IVectorStore
	embedder?: IEmbedder
	workspacePath: string
	batchSegmentThreshold: number
	fileProcessingConcurrencyLimit: number
	onBatchProgressUpdate: vscode.EventEmitter<{
		processedInBatch: number
		totalInBatch: number
		currentFile?: string
	}>
	processFile: (filePath: string) => Promise<FileProcessingResult>
	captureError: (location: string, errorType: string, extra?: Record<string, unknown>) => void
}
