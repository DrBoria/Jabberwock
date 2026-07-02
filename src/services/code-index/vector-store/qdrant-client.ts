import { IVectorStore } from "@services/code-index/interfaces/vector-store"
import { VectorStoreSearchResult } from "@services/code-index/interfaces"
import { QdrantClient } from "@qdrant/js-client-rest"

import {
	buildFileDeletionFilters,
	buildSearchRequest,
	createQdrantClient,
	extractVectorSize,
	generateCollectionName,
	handleQdrantInitializeError,
	isQdrantPayloadValid,
	logQdrantDeletionError,
	parseQdrantUrl,
	processPointsWithPathSegments,
} from "./qdrantHelpers"
import {
	getQdrantCollectionInfo,
	recreateQdrantCollectionWithNewDimension,
	createQdrantPayloadIndexes,
} from "./qdrantCollectionManager"
import { checkQdrantIndexedData, markQdrantIndexingComplete, markQdrantIndexingIncomplete } from "./qdrantMetadata"

/**
 * Qdrant implementation of the vector store interface
 */
export class QdrantVectorStore implements IVectorStore {
	private readonly vectorSize!: number
	private readonly DISTANCE_METRIC = "Cosine"

	private client: QdrantClient
	private readonly collectionName: string
	private readonly qdrantUrl: string = "http://localhost:6333"
	private readonly workspacePath: string

	constructor(workspacePath: string, url: string, vectorSize: number, apiKey?: string) {
		const parsedUrl = parseQdrantUrl(url)

		this.qdrantUrl = parsedUrl
		this.workspacePath = workspacePath
		this.client = createQdrantClient(parsedUrl, apiKey)
		this.vectorSize = vectorSize
		this.collectionName = generateCollectionName(workspacePath)
	}

	async initialize(): Promise<boolean> {
		let created = false
		try {
			const collectionInfo = await getQdrantCollectionInfo(this.client, this.collectionName)

			if (collectionInfo === null) {
				await this.client.createCollection(this.collectionName, {
					vectors: {
						size: this.vectorSize,
						distance: this.DISTANCE_METRIC,
						on_disk: true,
					},
					hnsw_config: {
						m: 64,
						ef_construct: 512,
						on_disk: true,
					},
				})
				created = true
			} else {
				const vectorsConfig = collectionInfo.config?.params?.vectors
				const existingVectorSize = extractVectorSize(vectorsConfig)
				if (existingVectorSize === this.vectorSize) {
					created = false
				} else {
					created = await recreateQdrantCollectionWithNewDimension(
						this.client,
						this.collectionName,
						this.vectorSize,
					)
				}
			}

			await createQdrantPayloadIndexes(this.client, this.collectionName)
			return created
		} catch (error) {
			handleQdrantInitializeError(error, this.collectionName, this.qdrantUrl)
		}
	}

	async upsertPoints(
		points: Array<{
			id: string
			vector: number[]
			payload: Record<string, unknown>
		}>,
	): Promise<void> {
		try {
			const processedPoints = processPointsWithPathSegments(points)

			await this.client.upsert(this.collectionName, {
				points: processedPoints,
				wait: true,
			})
		} catch (error) {
			console.error("[jabberwock] Failed to upsert points:", error)
			throw error
		}
	}

	async search(
		queryVector: number[],
		directoryPrefix?: string,
		minScore?: number,
		maxResults?: number,
	): Promise<VectorStoreSearchResult[]> {
		try {
			const searchRequest = buildSearchRequest(queryVector, directoryPrefix, minScore, maxResults)

			const operationResult = await this.client.query(this.collectionName, searchRequest)
			const filteredPoints = operationResult.points.filter((p) => isQdrantPayloadValid(p.payload))

			return filteredPoints.map((p) => ({
				id: p.id,
				score: p.score,
				payload: p.payload as Record<string, unknown>,
			})) as VectorStoreSearchResult[]
		} catch (error) {
			console.error("[jabberwock] Failed to search points:", error)
			throw error
		}
	}

	async deletePointsByFilePath(filePath: string): Promise<void> {
		return this.deletePointsByMultipleFilePaths([filePath])
	}

	async deletePointsByMultipleFilePaths(filePaths: string[]): Promise<void> {
		if (filePaths.length === 0) {
			return
		}

		try {
			const collectionExists = await this.collectionExists()
			if (!collectionExists) {
				console.warn(
					`[QdrantVectorStore] Skipping deletion - collection "${this.collectionName}" does not exist`,
				)
				return
			}

			const filter = buildFileDeletionFilters(filePaths, this.workspacePath)

			await this.client.delete(this.collectionName, {
				filter,
				wait: true,
			})
		} catch (error) {
			logQdrantDeletionError(error, filePaths, this.collectionName)
		}
	}

	async deleteCollection(): Promise<void> {
		try {
			if (await this.collectionExists()) {
				await this.client.deleteCollection(this.collectionName)
			}
		} catch (error) {
			console.error(`[jabberwock] [QdrantVectorStore] Failed to delete collection ${this.collectionName}:`, error)
			throw error
		}
	}

	async clearCollection(): Promise<void> {
		try {
			await this.client.delete(this.collectionName, {
				filter: {
					must: [],
				},
				wait: true,
			})
		} catch (error) {
			console.error("[jabberwock] Failed to clear collection:", error)
			throw error
		}
	}

	async collectionExists(): Promise<boolean> {
		const collectionInfo = await getQdrantCollectionInfo(this.client, this.collectionName)
		return collectionInfo !== null
	}

	async hasIndexedData(): Promise<boolean> {
		return checkQdrantIndexedData(this.client, this.collectionName, this.vectorSize)
	}

	async markIndexingComplete(): Promise<void> {
		return markQdrantIndexingComplete(this.client, this.collectionName, this.vectorSize)
	}

	async markIndexingIncomplete(): Promise<void> {
		return markQdrantIndexingIncomplete(this.client, this.collectionName, this.vectorSize)
	}
}
