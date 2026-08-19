import * as path from "path"
import { createHash } from "crypto"

import { DEFAULT_MAX_SEARCH_RESULTS, DEFAULT_SEARCH_MIN_SCORE } from "@services/code-index/constants"

import { buildQdrantSearchFilter } from "./qdrant-filters"

export function generateCollectionName(workspacePath: string): string {
	const hash = createHash("sha256").update(workspacePath).digest("hex")
	return `ws-${hash.substring(0, 16)}`
}

export function extractVectorSize(vectorsConfig: unknown): number {
	if (typeof vectorsConfig === "number") {
		return vectorsConfig
	}
	if (
		vectorsConfig &&
		typeof vectorsConfig === "object" &&
		"size" in vectorsConfig &&
		typeof (vectorsConfig as Record<string, unknown>).size === "number"
	) {
		return (vectorsConfig as Record<string, unknown>).size as number
	}
	return 0
}

export function isQdrantPayloadValid(
	payload: Record<string, unknown> | null | undefined,
): payload is Record<string, unknown> {
	if (!payload) {
		return false
	}
	const validKeys = ["filePath", "codeChunk", "startLine", "endLine"]
	return validKeys.every((key) => key in payload)
}

export function processPointsWithPathSegments(
	points: Array<{
		id: string
		vector: number[]
		payload: Record<string, unknown>
	}>,
): Array<{
	id: string
	vector: number[]
	payload: Record<string, unknown>
}> {
	return points.map((point) => {
		if (point.payload?.filePath) {
			const segments = (point.payload.filePath as string).split(path.sep).filter(Boolean)
			const pathSegments = segments.reduce((acc: Record<string, string>, segment: string, index: number) => {
				acc[index.toString()] = segment
				return acc
			}, {})
			return {
				...point,
				payload: {
					...point.payload,
					pathSegments,
				},
			}
		}
		return point
	})
}

export function buildSearchRequest(
	queryVector: number[],
	directoryPrefix?: string,
	minScore?: number,
	maxResults?: number,
): {
	query: number[]
	filter: Record<string, unknown>
	score_threshold: number
	limit: number
	params: { hnsw_ef: number; exact: boolean }
	with_payload: { include: string[] }
} {
	const filter = buildQdrantSearchFilter(directoryPrefix)

	const metadataExclusion = {
		must_not: [{ key: "type", match: { value: "metadata" } }],
	}

	const mergedFilter = filter
		? { ...filter, must_not: [...(filter.must_not || []), ...metadataExclusion.must_not] }
		: metadataExclusion

	return {
		query: queryVector,
		filter: mergedFilter,
		score_threshold: minScore ?? DEFAULT_SEARCH_MIN_SCORE,
		limit: maxResults ?? DEFAULT_MAX_SEARCH_RESULTS,
		params: {
			hnsw_ef: 128,
			exact: false,
		},
		with_payload: {
			include: ["filePath", "codeChunk", "startLine", "endLine", "pathSegments"],
		},
	}
}
