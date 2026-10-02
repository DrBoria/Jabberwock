import { z } from "zod"
import { useQuery } from "@tanstack/react-query"
import { useFuzzyModelSearch, fetchModelList } from "./use-fuzzy-model-search"

export const openRouterModelSchema = z.object({
	id: z.string(),
	name: z.string(),
})

export type OpenRouterModel = z.infer<typeof openRouterModelSchema>

export const useOpenRouterModels = () => {
	const query = useQuery({
		queryKey: ["getOpenRouterModels"],
		queryFn: () =>
			fetchModelList(
				"https://openrouter.ai/api/v1/models",
				openRouterModelSchema,
				z.object({ data: z.array(openRouterModelSchema) }),
			),
	})

	const { searchValue, setSearchValue, onFilter } = useFuzzyModelSearch(query.data)

	return { ...query, searchValue, setSearchValue, onFilter }
}
