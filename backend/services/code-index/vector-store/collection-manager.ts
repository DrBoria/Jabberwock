import { QdrantClient, Schemas } from "@qdrant/js-client-rest"
import { t } from "@i18n"

export async function getQdrantCollectionInfo(
	client: QdrantClient,
	collectionName: string,
): Promise<Schemas["CollectionInfo"] | null> {
	try {
		return await client.getCollection(collectionName)
	} catch (error: unknown) {
		if (error instanceof Error) {
			console.warn(
				`[QdrantVectorStore] Warning during getCollectionInfo for "${collectionName}". Collection may not exist or another error occurred:`,
				error.message,
			)
		}
		return null
	}
}

export async function recreateQdrantCollectionWithNewDimension(
	client: QdrantClient,
	collectionName: string,
	vectorSize: number,
): Promise<boolean> {
	console.warn(
		`[QdrantVectorStore] Collection ${collectionName} exists with unexpected vector size. Recreating collection.`,
	)

	let deletionSucceeded = false
	let recreationAttempted = false

	try {
		console.log(`[QdrantVectorStore] Deleting existing collection ${collectionName}...`)
		await client.deleteCollection(collectionName)
		deletionSucceeded = true
		console.log(`[QdrantVectorStore] Successfully deleted collection ${collectionName}`)

		await new Promise((resolve) => setTimeout(resolve, 100))

		const verificationInfo = await getQdrantCollectionInfo(client, collectionName)
		if (verificationInfo !== null) {
			throw new Error("Collection still exists after deletion attempt")
		}

		console.log(`[QdrantVectorStore] Creating new collection ${collectionName} with vector size ${vectorSize}...`)
		recreationAttempted = true
		await client.createCollection(collectionName, {
			vectors: {
				size: vectorSize,
				distance: "Cosine",
				on_disk: true,
			},
			hnsw_config: {
				m: 64,
				ef_construct: 512,
				on_disk: true,
			},
		})
		console.log(`[QdrantVectorStore] Successfully created new collection ${collectionName}`)
		return true
	} catch (recreationError) {
		const errorMessage = recreationError instanceof Error ? recreationError.message : String(recreationError)

		let contextualErrorMessage: string
		if (!deletionSucceeded) {
			contextualErrorMessage = `Failed to delete existing collection. ${errorMessage}`
		} else if (!recreationAttempted) {
			contextualErrorMessage = `Deleted existing collection but failed verification step. ${errorMessage}`
		} else {
			contextualErrorMessage = `Deleted existing collection but failed to create new collection with vector size ${vectorSize}. ${errorMessage}`
		}

		console.error(
			`[QdrantVectorStore] CRITICAL: Failed to recreate collection ${collectionName} for dimension change. ${contextualErrorMessage}`,
		)

		const dimensionMismatchError = new Error(
			t("embeddings:vectorStore.vectorDimensionMismatch", {
				errorMessage: contextualErrorMessage,
			}),
		)

		dimensionMismatchError.cause = recreationError
		throw dimensionMismatchError
	}
}

export async function createQdrantPayloadIndexes(client: QdrantClient, collectionName: string): Promise<void> {
	try {
		await client.createPayloadIndex(collectionName, {
			field_name: "type",
			field_schema: "keyword",
		})
	} catch (indexError) {
		const errorMessage = (indexError as Record<string, unknown>)?.message as string
		if (!errorMessage?.toLowerCase().includes("already exists")) {
			console.warn(
				`[QdrantVectorStore] Could not create payload index for type on ${collectionName}. Details:`,
				(indexError as Record<string, unknown>)?.message || indexError,
			)
		}
	}

	for (let i = 0; i <= 4; i++) {
		await createQdrantPathSegmentIndex(client, collectionName, i)
	}
}

async function createQdrantPathSegmentIndex(
	client: QdrantClient,
	collectionName: string,
	index: number,
): Promise<void> {
	try {
		await client.createPayloadIndex(collectionName, {
			field_name: `pathSegments.${index}`,
			field_schema: "keyword",
		})
	} catch (indexError: unknown) {
		const err = indexError as Record<string, unknown>
		const errorMessage = (typeof err?.message === "string" ? err.message : "").toLowerCase()
		if (!errorMessage.includes("already exists")) {
			console.warn(
				`[QdrantVectorStore] Could not create payload index for pathSegments.${index} on ${collectionName}. Details:`,
				err?.message || indexError,
			)
		}
	}
}
