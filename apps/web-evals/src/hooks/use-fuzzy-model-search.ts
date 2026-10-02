import { useCallback, useRef, useState } from "react"
import fuzzysort from "fuzzysort"
import { z } from "zod"

interface ModelWithId {
	id: string
	name: string
}

/**
 * Shared fetch → parse → sort pipeline for the model-listing hooks
 * (`use-jabberwock-cloud-models.ts`, `use-open-router-models.ts`). Fetches
 * `url`, parses the body against `wrapperSchema` (which must expose a `data`
 * array of `itemSchema` items) and returns the items sorted by name
 * (localeCompare). Returns `[]` on a non-OK response or a parse failure.
 */
export async function fetchModelList<T extends ModelWithId>(
	url: string,
	itemSchema: z.ZodType<T>,
	wrapperSchema: z.ZodType<{ data: T[] }>,
): Promise<T[]> {
	const response = await fetch(url)

	if (!response.ok) {
		return []
	}

	const result = wrapperSchema.safeParse(await response.json())

	if (!result.success) {
		console.error(result.error)
		return []
	}

	return result.data.data.sort((a, b) => a.name.localeCompare(b.name))
}

export const useFuzzyModelSearch = <T extends ModelWithId>(data: T[] | undefined) => {
	const [searchValue, setSearchValue] = useState("")

	const searchResultsRef = useRef<Map<string, number>>(new Map())
	const searchValueRef = useRef("")

	const onFilter = useCallback(
		(value: string, search: string) => {
			if (searchValueRef.current !== search) {
				searchValueRef.current = search
				searchResultsRef.current.clear()

				for (const {
					obj: { id },
					score,
				} of fuzzysort.go(search, data || [], {
					key: "name",
				})) {
					searchResultsRef.current.set(id, score)
				}
			}

			return searchResultsRef.current.get(value) ?? 0
		},
		[data],
	)

	return { searchValue, setSearchValue, onFilter }
}
