import { VectorStoreSearchResult } from "@services/code-index/interfaces"
import { QdrantClient, Schemas } from "@qdrant/js-client-rest"

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
} from "./collection-manager"
import { checkQdrantIndexedData, markQdrantIndexingComplete, markQdrantIndexingIncomplete } from "./metadata"

/**
 * Qdrant implementation of the vector store interface
 */
export function QdrantVectorStore(workspacePath: string, url: string, vectorSize: number, apiKey?: string) {
	const DISTANCE_METRIC = "Cosine"
	const parsedUrl = parseQdrantUrl(url)
	const qdrantUrl = parsedUrl
	const client: QdrantClient = createQdrantClient(parsedUrl, apiKey)

	const collectionName = generateCollectionName(workspacePath)

	const handler = {
		vectorSize,
		DISTANCE_METRIC: DISTANCE_METRIC,
		client: client,
		collectionName: collectionName,
		qdrantUrl: qdrantUrl,
		workspacePath,
		async initialize(): Promise<boolean> {
			let created = false
			try {
				const collectionInfo = await getQdrantCollectionInfo(handler.client, handler.collectionName)
				if (collectionInfo === null) {
					await handler.client.createCollection(handler.collectionName, {
						vectors: {
							size: handler.vectorSize,
							distance: "Cosine",
							on_disk: true,
						} satisfies Schemas["VectorParams"],
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
					if (existingVectorSize === handler.vectorSize) {
						created = false
					} else {
						created = await recreateQdrantCollectionWithNewDimension(
							handler.client,
							handler.collectionName,
							handler.vectorSize,
						)
					}
				}
				await createQdrantPayloadIndexes(handler.client, handler.collectionName)
				return created
			} catch (error) {
				handleQdrantInitializeError(error, handler.collectionName, handler.qdrantUrl)
			}
		},
		async upsertPoints(
			points: Array<{
				id: string
				vector: number[]
				payload: Record<string, unknown>
			}>,
		): Promise<void> {
			try {
				const processedPoints = processPointsWithPathSegments(points)
				await handler.client.upsert(handler.collectionName, {
					points: processedPoints,
					wait: true,
				})
			} catch (error) {
				console.error("[jabberwock] Failed to upsert points:", error)
				throw error
			}
		},
		async search(
			queryVector: number[],
			directoryPrefix?: string,
			minScore?: number,
			maxResults?: number,
		): Promise<VectorStoreSearchResult[]> {
			try {
				const searchRequest = buildSearchRequest(queryVector, directoryPrefix, minScore, maxResults)
				const operationResult = await handler.client.query(handler.collectionName, searchRequest)
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
		},
		async deletePointsByFilePath(filePath: string): Promise<void> {
			return handler.deletePointsByMultipleFilePaths([filePath])
		},
		async deletePointsByMultipleFilePaths(filePaths: string[]): Promise<void> {
			if (filePaths.length === 0) {
				return
			}
			try {
				const collectionExists = await handler.collectionExists()
				if (!collectionExists) {
					console.warn(
						`[QdrantVectorStore] Skipping deletion - collection "${handler.collectionName}" does not exist`,
					)
					return
				}
				const filter = buildFileDeletionFilters(filePaths, handler.workspacePath)
				await handler.client.delete(handler.collectionName, {
					filter,
					wait: true,
				})
			} catch (error) {
				logQdrantDeletionError(error, filePaths, handler.collectionName)
			}
		},
		async deleteCollection(): Promise<void> {
			try {
				if (await handler.collectionExists()) {
					await handler.client.deleteCollection(handler.collectionName)
				}
			} catch (error) {
				console.error(
					`[jabberwock] [QdrantVectorStore] Failed to delete collection ${handler.collectionName}:`,
					error,
				)
				throw error
			}
		},
		async clearCollection(): Promise<void> {
			try {
				await handler.client.delete(handler.collectionName, {
					filter: {
						must: [],
					},
					wait: true,
				})
			} catch (error) {
				console.error("[jabberwock] Failed to clear collection:", error)
				throw error
			}
		},
		async collectionExists(): Promise<boolean> {
			const collectionInfo = await getQdrantCollectionInfo(handler.client, handler.collectionName)
			return collectionInfo !== null
		},
		async hasIndexedData(): Promise<boolean> {
			return checkQdrantIndexedData(handler.client, handler.collectionName, handler.vectorSize)
		},
		async markIndexingComplete(): Promise<void> {
			return markQdrantIndexingComplete(handler.client, handler.collectionName, handler.vectorSize)
		},
		async markIndexingIncomplete(): Promise<void> {
			return markQdrantIndexingIncomplete(handler.client, handler.collectionName, handler.vectorSize)
		},
	}
	return handler
}
