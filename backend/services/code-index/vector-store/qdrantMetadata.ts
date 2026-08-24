import { QdrantClient } from "@qdrant/js-client-rest"
import { v5 as uuidv5 } from "uuid"
import { QDRANT_CODE_BLOCK_NAMESPACE } from "@services/code-index/constants"
import { getQdrantCollectionInfo } from "./qdrantCollectionManager"

export async function checkQdrantIndexedData(
	client: QdrantClient,
	collectionName: string,
	_vectorSize: number,
): Promise<boolean> {
	try {
		const collectionInfo = await getQdrantCollectionInfo(client, collectionName)
		if (!collectionInfo) {
			return false
		}
		const pointsCount = collectionInfo.points_count ?? 0
		if (pointsCount === 0) {
			return false
		}

		const metadataId = uuidv5("__indexing_metadata__", QDRANT_CODE_BLOCK_NAMESPACE)
		const metadataPoints = await client.retrieve(collectionName, {
			ids: [metadataId],
		})

		if (metadataPoints.length > 0) {
			return metadataPoints[0].payload?.indexing_complete === true
		}

		console.log(
			"[QdrantVectorStore] No indexing metadata marker found. Using backward compatibility mode (checking points_count > 0).",
		)
		return pointsCount > 0
	} catch (error) {
		console.warn("[jabberwock] [QdrantVectorStore] Failed to check if collection has data:", error)
		return false
	}
}

export async function markQdrantIndexingComplete(
	client: QdrantClient,
	collectionName: string,
	vectorSize: number,
): Promise<void> {
	try {
		const metadataId = uuidv5("__indexing_metadata__", QDRANT_CODE_BLOCK_NAMESPACE)

		await client.upsert(collectionName, {
			points: [
				{
					id: metadataId,
					vector: new Array(vectorSize).fill(0),
					payload: {
						type: "metadata",
						indexing_complete: true,
						completed_at: Date.now(),
					},
				},
			],
			wait: true,
		})
		console.log("[QdrantVectorStore] Marked indexing as complete")
	} catch (error) {
		console.error("[jabberwock] [QdrantVectorStore] Failed to mark indexing as complete:", error)
		throw error
	}
}

export async function markQdrantIndexingIncomplete(
	client: QdrantClient,
	collectionName: string,
	vectorSize: number,
): Promise<void> {
	try {
		const metadataId = uuidv5("__indexing_metadata__", QDRANT_CODE_BLOCK_NAMESPACE)

		await client.upsert(collectionName, {
			points: [
				{
					id: metadataId,
					vector: new Array(vectorSize).fill(0),
					payload: {
						type: "metadata",
						indexing_complete: false,
						started_at: Date.now(),
					},
				},
			],
			wait: true,
		})
		console.log("[QdrantVectorStore] Marked indexing as incomplete (in progress)")
	} catch (error) {
		console.error("[jabberwock] [QdrantVectorStore] Failed to mark indexing as incomplete:", error)
		throw error
	}
}
