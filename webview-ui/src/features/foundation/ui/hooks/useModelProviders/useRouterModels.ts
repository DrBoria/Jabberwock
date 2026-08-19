import { useQuery } from "@tanstack/react-query"
import { onSnapshot } from "mobx-state-tree"

import { type RouterModels } from "@jabberwock/types"

import { rootStore } from "@src/features/store"
import { routerModelsStore } from "@src/features/settings/models/store"

type UseRouterModelsOptions = {
	provider?: string // single provider filter (e.g. "jabberwock")
	enabled?: boolean // gate fetching entirely
}

const getRouterModels = async (provider?: string) =>
	new Promise<RouterModels>((resolve, reject) => {
		// For "all" requests, check the MST store first (avoids unnecessary requests)
		if (!provider) {
			const existing = routerModelsStore.routerModels
			if (existing) {
				resolve(existing)
				return
			}
		}

		// Subscribe to MST store changes instead of raw message events
		const unsubscribe = onSnapshot(routerModelsStore, (snapshot) => {
			if (!snapshot.routerModels) return

			// For "all" requests, resolve when store has data
			if (!provider) {
				unsubscribe()
				clearTimeout(timeout)
				resolve(snapshot.routerModels)
			}
		})

		const timeout = setTimeout(() => {
			unsubscribe()
			reject(new Error("Router models request timed out"))
		}, 10000)

		if (provider) {
			rootStore.settings.requestRouterModels({ provider })
		} else {
			rootStore.settings.requestRouterModels()
		}
	})

export const useRouterModels = (opts: UseRouterModelsOptions = {}) => {
	const provider = opts.provider || undefined
	return useQuery({
		queryKey: ["routerModels", provider || "all"],
		queryFn: () => getRouterModels(provider),
		enabled: opts.enabled !== false,
	})
}
