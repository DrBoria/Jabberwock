import { useQuery } from "@tanstack/react-query"
import { onSnapshot } from "mobx-state-tree"

import { type ModelRecord } from "@jabberwock/types"

import { vscode } from "@jabberwock/devtool/react"
import { routerModelsStore } from "@src/features/settings/models/store"

const getLmStudioModels = async () =>
	new Promise<ModelRecord>((resolve, reject) => {
		// Check the MST store first
		const existing = routerModelsStore.lmStudioModels
		if (existing) {
			resolve(existing)
			return
		}

		// Subscribe to MST store changes
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

		vscode.postMessage({ type: "requestLmStudioModels" })
	})

export const useLmStudioModels = (modelId?: string) =>
	useQuery({ queryKey: ["lmStudioModels"], queryFn: () => (modelId ? getLmStudioModels() : {}) })
