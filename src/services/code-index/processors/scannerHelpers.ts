import { createHash } from "crypto"
import { v5 as uuidv5 } from "uuid"
import pLimit from "p-limit"
import { Mutex } from "async-mutex"
import { CodeBlock } from "@services/code-index/interfaces"
import { QDRANT_CODE_BLOCK_NAMESPACE, MAX_BATCH_RETRIES, INITIAL_RETRY_DELAY_MS } from "@services/code-index/constants"
import { getTelemetryService } from "@jabberwock/telemetry"
import { TelemetryEventName } from "@jabberwock/types"
import { sanitizeErrorMessage } from "@services/code-index/shared/sanitizeInput"
import { t } from "@i18n"
import { generateNormalizedAbsolutePath, generateRelativeFilePath } from "@services/code-index/shared/get-relative-path"

export type BatchContext = {
	currentBatchBlocks: CodeBlock[]
	currentBatchTexts: string[]
	currentBatchFileInfos: { filePath: string; fileHash: string; isNew: boolean }[]
	activeBatchPromises: Set<Promise<void>>
	pendingBatchCount: number
	totalBlockCount: number
	mutex: Mutex
	batchLimiter: ReturnType<typeof pLimit>
	scanWorkspace: string
	onError?: (error: Error) => void
	onBlocksIndexed?: (indexedCount: number) => void
}

function tryGetDirectStatus(error: Record<string, unknown>): string | undefined {
	if ("status" in error) {
		const status = error.status
		if (typeof status === "string") {
			return status
		}
	}
	return undefined
}

function tryGetStatusCode(error: Record<string, unknown>): string | undefined {
	if ("statusCode" in error) {
		const statusCode = error.statusCode
		if (typeof statusCode === "string") {
			return statusCode
		}
	}
	return undefined
}

function tryGetResponseStatus(error: Record<string, unknown>): string | undefined {
	if ("response" in error) {
		const response = error.response
		if (response !== null && typeof response === "object" && "status" in response) {
			const responseStatus = response.status
			if (typeof responseStatus === "string") {
				return responseStatus
			}
		}
	}
	return undefined
}

export function extractErrorStatus(error: unknown): string | undefined {
	if (error === null || typeof error !== "object") {
		return undefined
	}

	const err = error as Record<string, unknown>
	const directStatus = tryGetDirectStatus(err)
	if (directStatus !== undefined) {
		return directStatus
	}

	const statusCode = tryGetStatusCode(err)
	if (statusCode !== undefined) {
		return statusCode
	}

	return tryGetResponseStatus(err)
}

export function handleFileError(
	error: unknown,
	filePath: string,
	scanWorkspace: string,
	onError?: (error: Error) => void,
): void {
	if (error instanceof DOMException && error.name === "AbortError") {
		throw error
	}
	console.error(`[jabberwock] Error processing file ${filePath} in workspace ${scanWorkspace}:`, error)
	getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
		error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
		stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
		location: "scanDirectory:processFile",
	})
	if (onError) {
		const contextMessage = ` (Workspace: ${scanWorkspace}, File: ${filePath})`
		onError(
			error instanceof Error
				? new Error(`${error.message}${contextMessage}`)
				: new Error(t("embeddings:scanner.unknownErrorProcessingFile", { filePath }) + contextMessage),
		)
	}
}

export function reportBatchFailure(lastError: Error, onError?: (error: Error) => void): void {
	console.error(`[jabberwock] [DirectoryScanner] Failed to process batch after ${MAX_BATCH_RETRIES} attempts`)
	if (!onError) {
		return
	}

	const errorMessage = lastError.message || "Unknown error"
	onError(
		new Error(
			t("embeddings:scanner.failedToProcessBatchWithError", {
				maxRetries: MAX_BATCH_RETRIES,
				errorMessage,
			}),
		),
	)
}

export function reportDeletionError(
	error: unknown,
	cachedFilePath: string,
	scanWorkspace: string,
	onError?: (error: Error) => void,
): void {
	const errorStatus = extractErrorStatus(error)
	const errorMessage = error instanceof Error ? error.message : String(error)

	console.error(
		`[DirectoryScanner] Failed to delete points for ${cachedFilePath} in workspace ${scanWorkspace}:`,
		error,
	)

	getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
		error: sanitizeErrorMessage(errorMessage),
		stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
		location: "scanDirectory:deleteRemovedFiles",
		errorStatus,
	})

	if (onError) {
		const contextMessage = ` (Workspace: ${scanWorkspace}, File: ${cachedFilePath})`
		onError(
			error instanceof Error
				? new Error(`${error.message}${contextMessage}`)
				: new Error(
						t("embeddings:scanner.unknownErrorDeletingPoints", {
							filePath: cachedFilePath,
						}) + contextMessage,
					),
		)
	}

	console.error(`[jabberwock] Failed to delete points for removed file: ${cachedFilePath}`, error)
}

export function reportBatchDeletionError(deleteError: unknown, fileCount: number, scanWorkspace: string): void {
	const errorStatus = extractErrorStatus(deleteError)
	const errorMessage = deleteError instanceof Error ? deleteError.message : String(deleteError)

	console.error(
		`[DirectoryScanner] Failed to delete points for ${fileCount} files before upsert in workspace ${scanWorkspace}:`,
		deleteError,
	)

	getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
		error: sanitizeErrorMessage(errorMessage),
		stack: deleteError instanceof Error ? sanitizeErrorMessage(deleteError.stack || "") : undefined,
		location: "processBatch:deletePointsByMultipleFilePaths",
		fileCount,
		errorStatus,
	})
}

export async function handleBatchProcessingError(error: unknown, attempt: number, batchSize: number): Promise<void> {
	console.error(`[DirectoryScanner] Error processing batch (attempt ${attempt}):`, error)
	getTelemetryService().captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
		error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
		stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
		location: "processBatch:retry",
		attemptNumber: attempt,
		batchSize,
	})

	const shouldRetry = attempt < MAX_BATCH_RETRIES
	if (shouldRetry) {
		const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1)
		await new Promise((resolve) => setTimeout(resolve, delay))
	}
}

export function buildBatchPoints(
	batchBlocks: CodeBlock[],
	embeddings: number[][],
	scanWorkspace: string,
): { id: string; vector: number[]; payload: Record<string, unknown> }[] {
	return batchBlocks.map((block, index) => {
		const normalizedAbsolutePath = generateNormalizedAbsolutePath(block.file_path, scanWorkspace)
		const pointId = uuidv5(block.segmentHash, QDRANT_CODE_BLOCK_NAMESPACE)

		return {
			id: pointId,
			vector: embeddings[index],
			payload: {
				filePath: generateRelativeFilePath(normalizedAbsolutePath, scanWorkspace),
				codeChunk: block.content,
				startLine: block.start_line,
				endLine: block.end_line,
				segmentHash: block.segmentHash,
			},
		}
	})
}
