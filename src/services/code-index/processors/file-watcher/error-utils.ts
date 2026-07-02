export function extractResponseStatus(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null) {
		return undefined
	}
	if (!("response" in error)) {
		return undefined
	}
	const response = error.response
	if (
		typeof response === "object" &&
		response !== null &&
		"status" in response &&
		typeof response.status === "string"
	) {
		return response.status
	}
	return undefined
}

export function extractDeletionErrorStatus(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null) {
		return undefined
	}
	if ("status" in error && typeof error.status === "string") {
		return error.status
	}
	const responseStatus = extractResponseStatus(error)
	if (responseStatus !== undefined) {
		return responseStatus
	}
	if ("statusCode" in error && typeof error.statusCode === "string") {
		return error.statusCode
	}
	return undefined
}

export function toError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error))
}
