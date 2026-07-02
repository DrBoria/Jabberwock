import * as path from "path"
import * as vscode from "vscode"
import { stat } from "fs/promises"
import { createHash } from "crypto"
import { Ignore } from "ignore"

import { generateRelativeFilePath } from "@services/code-index/shared/get-relative-path"
import { scannerExtensions } from "@services/code-index/shared/supported-extensions"
import { CodeBlock, ICodeParser, IVectorStore } from "@services/code-index/interfaces"
import { CacheManager } from "@services/code-index/cache-manager"
import { MAX_FILE_SIZE_BYTES } from "@services/code-index/constants"
import { isPathInIgnoredDirectory } from "@services/glob/ignore-utils"
import {
	handleBatchProcessingError,
	reportBatchDeletionError,
	reportBatchFailure,
	reportDeletionError,
} from "@services/code-index/processors/scannerHelpers"

export function filterSupportedPaths(ignoreInstance: Ignore, allowedPaths: string[], scanWorkspace: string): string[] {
	return allowedPaths.filter((filePath) => {
		const ext = path.extname(filePath).toLowerCase()
		const relativeFilePath = generateRelativeFilePath(filePath, scanWorkspace)
		if (isPathInIgnoredDirectory(relativeFilePath)) {
			return false
		}
		const isSupported = scannerExtensions.includes(ext)
		const isNotIgnored = !ignoreInstance.ignores(relativeFilePath)
		return isSupported && isNotIgnored
	})
}

export async function readAndParseFile(
	cacheManager: CacheManager,
	codeParser: ICodeParser,
	filePath: string,
	scanWorkspace: string,
	signal: AbortSignal | undefined,
): Promise<{
	content: string
	currentFileHash: string
	isNewFile: boolean
	blocks: CodeBlock[]
	fileBlockCount: number
} | null> {
	const stats = await stat(filePath)
	if (stats.size > MAX_FILE_SIZE_BYTES) {
		return null
	}
	const content = await vscode.workspace.fs
		.readFile(vscode.Uri.file(filePath))
		.then((buffer) => Buffer.from(buffer).toString("utf-8"))
	const currentFileHash = createHash("sha256").update(content).digest("hex")
	const cachedFileHash = cacheManager.getHash(filePath)
	const isNewFile = !cachedFileHash
	if (cachedFileHash === currentFileHash) {
		return null
	}
	const blocks = await codeParser.parseFile(filePath, { content, fileHash: currentFileHash })
	const fileBlockCount = blocks.length
	return { content, currentFileHash, isNewFile, blocks, fileBlockCount }
}

export async function handleDeletedFiles(
	cacheManager: CacheManager,
	qdrantClient: IVectorStore | undefined,
	processedFiles: Set<string>,
	scanWorkspace: string,
	onError?: (error: Error) => void,
): Promise<void> {
	const oldHashes = cacheManager.getAllHashes()
	for (const cachedFilePath of Object.keys(oldHashes)) {
		if (!processedFiles.has(cachedFilePath)) {
			if (qdrantClient) {
				try {
					await qdrantClient.deletePointsByFilePath(cachedFilePath)
					await cacheManager.deleteHash(cachedFilePath)
				} catch (error) {
					reportDeletionError(error, cachedFilePath, scanWorkspace, onError)
				}
			}
		}
	}
}

export async function deleteExistingPoints(
	qdrantClient: IVectorStore,
	batchFileInfos: { filePath: string; fileHash: string; isNew: boolean }[],
	scanWorkspace: string,
): Promise<void> {
	const uniqueFilePaths = [...new Set(batchFileInfos.filter((info) => !info.isNew).map((info) => info.filePath))]
	if (uniqueFilePaths.length === 0) {
		return
	}
	try {
		await qdrantClient.deletePointsByMultipleFilePaths(uniqueFilePaths)
	} catch (deleteError) {
		reportBatchDeletionError(deleteError, uniqueFilePaths.length, scanWorkspace)
		const errorMessage = deleteError instanceof Error ? deleteError.message : String(deleteError)
		throw new Error(
			`Failed to delete points for ${uniqueFilePaths.length} files. Workspace: ${scanWorkspace}. ${errorMessage}`,
			{ cause: deleteError },
		)
	}
}
