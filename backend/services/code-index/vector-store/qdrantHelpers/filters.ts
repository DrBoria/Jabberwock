import * as path from "path"

export function buildQdrantSearchFilter(directoryPrefix?: string):
	| {
			must: Array<{ key: string; match: { value: string } }>
			must_not?: Array<{ key: string; match: { value: string } }>
	  }
	| undefined {
	if (!directoryPrefix) {
		return undefined
	}

	const normalizedPrefix = path.posix.normalize(directoryPrefix.replace(/\\/g, "/"))
	if (normalizedPrefix === "." || normalizedPrefix === "./") {
		return undefined
	}

	const cleanedPrefix = path.posix.normalize(
		normalizedPrefix.startsWith("./") ? normalizedPrefix.slice(2) : normalizedPrefix,
	)
	const segments = cleanedPrefix.split("/").filter(Boolean)
	if (segments.length === 0) {
		return undefined
	}

	return {
		must: segments.map((segment, index) => ({
			key: `pathSegments.${index}`,
			match: { value: segment },
		})),
	}
}

export function buildQdrantFileDeletionFilter(
	filePath: string,
	workspaceRoot: string,
): { must: Array<{ key: string; match: { value: string } }> } {
	const relativePath = path.isAbsolute(filePath) ? path.relative(workspaceRoot, filePath) : filePath
	const normalizedRelativePath = path.normalize(relativePath)
	const segments = normalizedRelativePath.split(path.sep).filter(Boolean)
	return {
		must: segments.map((segment, index) => ({
			key: `pathSegments.${index}`,
			match: { value: segment },
		})),
	}
}

export function buildFileDeletionFilters(filePaths: string[], workspaceRoot: string): Record<string, unknown> {
	if (filePaths.length === 0) {
		return {}
	}

	const filters = filePaths.map((filePath) => buildQdrantFileDeletionFilter(filePath, workspaceRoot))

	return filters.length === 1 ? filters[0] : { should: filters }
}
