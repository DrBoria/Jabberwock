import { t } from "@i18n"

export function handleQdrantInitializeError(error: unknown, collectionName: string, qdrantUrl: string): never {
	const err = error as Record<string, unknown>
	const errorMessage = (err?.message as string) || String(error)
	console.error(`[QdrantVectorStore] Failed to initialize Qdrant collection "${collectionName}":`, errorMessage)
	if (error instanceof Error && error.cause !== undefined) {
		throw error
	}
	throw new Error(t("embeddings:vectorStore.qdrantConnectionFailed", { qdrantUrl, errorMessage }))
}

export function extractQdrantErrorStatus(
	err: Record<string, unknown>,
	errResponse: Record<string, unknown> | undefined,
): string {
	if (typeof err?.status === "string") {
		return err.status as string
	}
	if (typeof errResponse?.status === "string") {
		return errResponse.status as string
	}
	if (typeof err?.statusCode === "string") {
		return err.statusCode as string
	}
	return ""
}

export function extractQdrantErrorDetails(
	err: Record<string, unknown>,
	errResponse: Record<string, unknown> | undefined,
): string {
	if (typeof errResponse?.data === "string") {
		return errResponse.data as string
	}
	if (typeof err?.data === "string") {
		return err.data as string
	}
	return ""
}

export function logQdrantDeletionError(error: unknown, filePaths: string[], collectionName: string): void {
	const err = error as Record<string, unknown>
	const errResponse = err?.response as Record<string, unknown> | undefined
	const errorMessage = (err?.message as string) || String(error)

	console.error(`[jabberwock] [QdrantVectorStore] Failed to delete points by file paths:`, {
		error: errorMessage,
		status: extractQdrantErrorStatus(err, errResponse),
		details: extractQdrantErrorDetails(err, errResponse),
		collection: collectionName,
		fileCount: filePaths.length,
		samplePaths: filePaths.slice(0, 3),
	})
}
