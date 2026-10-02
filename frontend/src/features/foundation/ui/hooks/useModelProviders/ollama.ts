import { useQuery } from "@tanstack/react-query"
import { onSnapshot } from "mobx-state-tree"

import { type ModelRecord } from "@jabberwock/types"

import { rootStore } from "@src/features/store"

const getOllamaModels = async () =>
	new Promise<ModelRecord>((resolve, reject) => {
		const existing = rootStore.routerModels.ollamaModels
		if (existing) {
			resolve(existing)
			return
		}

		const unsubscribe = onSnapshot(rootStore.routerModels, (snapshot) => {
			if (snapshot.ollamaModels) {
				unsubscribe()
				clearTimeout(timeout)
				resolve(snapshot.ollamaModels)
			}
		})

		const timeout = setTimeout(() => {
			unsubscribe()
			reject(new Error("Ollama models request timed out"))
		}, 10000)

		rootStore.settings.requestOllamaModels()
	})

export const useOllamaModels = (modelId?: string) => {
	const ollamaQueryKey = ["ollamaModels"] as const
	return useQuery({ queryKey: ollamaQueryKey, queryFn: () => (modelId ? getOllamaModels() : {}) })
}
