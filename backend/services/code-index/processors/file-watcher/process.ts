import { readFile, stat } from "fs/promises"
import { createHash } from "crypto"
import { v5 as uuidv5 } from "uuid"
import { Ignore } from "ignore"
import { QDRANT_CODE_BLOCK_NAMESPACE, MAX_FILE_SIZE_BYTES } from "@services/code-index/constants"
import { validateAccess } from "@utils/ignore"
import { FileProcessingResult, IEmbedder, PointStruct } from "@services/code-index/interfaces"
import { CacheManager } from "@services/code-index/cache-manager"
import { codeParser } from "@services/code-index/processors/parser"
import { generateNormalizedAbsolutePath, generateRelativeFilePath } from "@services/code-index/shared/get-relative-path"
import { isPathInIgnoredDirectory } from "@services/glob/ignore-utils"

export async function processFile(
	filePath: string,
	workspacePath: string,
	cacheManager: CacheManager,
	ignorePatterns: string | undefined,
	ignoreInstance: Ignore | undefined,
	embedder?: IEmbedder,
): Promise<FileProcessingResult> {
	try {
		const relativeFilePath = generateRelativeFilePath(filePath, workspacePath)

		if (isPathInIgnoredDirectory(relativeFilePath)) {
			return {
				path: filePath,
				status: "skipped" as const,
				reason: "File is in an ignored directory",
			}
		}

		if (
			!validateAccess(ignorePatterns, filePath, workspacePath) ||
			(ignoreInstance && ignoreInstance.ignores(relativeFilePath))
		) {
			return {
				path: filePath,
				status: "skipped" as const,
				reason: "File is ignored by .jabberwockignore or .gitignore",
			}
		}

		// v4 B2 (L5): node:fs — same size semantics as workspace.fs.stat for regular files.
		const fileStat = await stat(filePath)
		if (fileStat.size > MAX_FILE_SIZE_BYTES) {
			return {
				path: filePath,
				status: "skipped" as const,
				reason: "File is too large",
			}
		}

		// v4 B2 (L5): node:fs — Buffer#toString defaults to utf-8, same as before.
		const content = await readFile(filePath, "utf-8")

		const newHash = createHash("sha256").update(content).digest("hex")

		if (cacheManager.getHash(filePath) === newHash) {
			return {
				path: filePath,
				status: "skipped" as const,
				reason: "File has not changed",
			}
		}

		const blocks = await codeParser.parseFile(filePath, { content, fileHash: newHash })

		let pointsToUpsert: PointStruct[] = []
		if (embedder && blocks.length > 0) {
			const texts = blocks.map((block) => block.content)
			const { embeddings } = await embedder.createEmbeddings(texts)

			pointsToUpsert = blocks.map((block, index) => {
				const normalizedAbsolutePath = generateNormalizedAbsolutePath(block.file_path, workspacePath)
				const stableName = `${normalizedAbsolutePath}:${block.start_line}`
				const pointId = uuidv5(stableName, QDRANT_CODE_BLOCK_NAMESPACE)

				return {
					id: pointId,
					vector: embeddings[index],
					payload: {
						filePath: generateRelativeFilePath(normalizedAbsolutePath, workspacePath),
						codeChunk: block.content,
						startLine: block.start_line,
						endLine: block.end_line,
					},
				}
			})
		}

		return {
			path: filePath,
			status: "processed_for_batching" as const,
			newHash,
			pointsToUpsert,
		}
	} catch (error) {
		return {
			path: filePath,
			status: "local_error" as const,
			error: error as Error,
		}
	}
}
