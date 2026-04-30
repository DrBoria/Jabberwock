import { useQuery } from "@tanstack/react-query"
import { onSnapshot } from "mobx-state-tree"

import { type ModelRecord } from "@jabberwock/types"

import { vscode } from "@src/features/devtools/utils/vscode"
import { routerModelsStore } from "@src/features/router-models/store"

const getOllamaModels = async () =>
	new Promise<ModelRecord>((resolve, reject) => {
		// Check the MST store first
		const existing = routerModelsStore.ollamaModels
		if (existing) {
			resolve(existing)
			return
		}

		// Subscribe to MST store changes
		const unsubscribe = onSnapshot(routerModelsStore, (snapshot) => {
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

		vscode.postMessage({ type: "requestOllamaModels" })
	})

export const useOllamaModels = (modelId?: string) =>
	useQuery({ queryKey: ["ollamaModels"], queryFn: () => (modelId ? getOllamaModels() : {}) })
