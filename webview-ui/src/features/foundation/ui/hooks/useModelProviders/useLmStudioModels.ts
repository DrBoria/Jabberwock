import { useQuery } from "@tanstack/react-query"
import { onSnapshot } from "mobx-state-tree"

import { type ModelRecord } from "@jabberwock/types"

import { rootStore } from "@src/features/store"
import { routerModelsStore } from "@src/features/settings/models/store"

const getLmStudioModels = async () =>
	new Promise<ModelRecord>((resolve, reject) => {
		const existing = routerModelsStore.lmStudioModels
		if (existing) {
			resolve(existing)
			return
		}

		const unsubscribe = onSnapshot(routerModelsStore, (snapshot) => {
			if (snapshot.lmStudioModels) {
				unsubscribe()
				clearTimeout(timeout)
				resolve(snapshot.lmStudioModels)
			}
		})

		const timeout = setTimeout(() => {
			unsubscribe()
			reject(new Error("LM Studio models request timed out"))
		}, 10000)

		rootStore.settings.requestLmStudioModels()
	})

export const useLmStudioModels = (modelId?: string) => {
	const lmStudioQueryKey = ["lmStudioModels"] as const
	return useQuery({ queryKey: lmStudioQueryKey, queryFn: () => (modelId ? getLmStudioModels() : {}) })
}
