import type { BackendStore, FrontendBridge } from "../types.js"
import { getBackendStoreGuide, getFrontendStoreGuide, getBackendStoreHelper, getFrontendStoreHelper } from "./store.js"

export interface GetStoreStateParams {
	env?: "backend" | "frontend"
	store?: string
	path?: string
	cursor?: number
	limit?: number
	/** Comma-separated field names to extract from array elements (e.g. "id,tokensOut"). Only these fields are returned per element. */
	fields?: string
}

function getEnvGuide(backendStore: BackendStore | undefined): string {
	return JSON.stringify({
		guide: true,
		message: "Specify an environment with `env` parameter. Available environments:",
		environments: {
			backend: {
				description: "Extension host MST store",
				usage: 'get_store_state env="backend" [store="storeName"] [limit=N] [cursor=N]',
				available: backendStore?.getMstStore()
					? Object.keys(backendStore.getMstStore() as Record<string, unknown>)
					: [],
			},
			frontend: {
				description: "Webview React app MST store (via bridge)",
				usage: 'get_store_state env="frontend" [store="storeName"] [limit=N] [cursor=N]',
			},
		},
	})
}

function getStoreGuide(
	env: string,
	backendStore: BackendStore | undefined,
	frontendBridge: FrontendBridge | undefined,
): Promise<string> {
	if (env === "backend") {
		return getBackendStoreGuide(backendStore)
	}
	return getFrontendStoreGuide(frontendBridge)
}

async function getBackendState(
	backendStore: BackendStore,
	store: string,
	path?: string,
	cursor?: number,
	limit?: number,
	fields?: string,
): Promise<string> {
	if (!backendStore) {
		return JSON.stringify({ error: "Backend store not available" })
	}
	return getBackendStoreHelper(backendStore, store, path, cursor, limit, fields)
}

async function getFrontendState(
	frontendBridge: FrontendBridge,
	store: string,
	path?: string,
	cursor?: number,
	limit?: number,
	fields?: string,
): Promise<string> {
	if (!frontendBridge) {
		return JSON.stringify({ error: "Frontend bridge not available" })
	}
	return getFrontendStoreHelper(frontendBridge, store, path, cursor, limit, fields)
}

export async function getStoreState(
	params: GetStoreStateParams,
	backendStore: BackendStore | undefined,
	frontendBridge: FrontendBridge | undefined,
): Promise<string> {
	const { env, store, path, cursor = 0, limit = 10, fields } = params

	if (!env) {
		return getEnvGuide(backendStore)
	}

	if (!store) {
		return getStoreGuide(env, backendStore, frontendBridge)
	}

	if (env === "backend") {
		return getBackendState(backendStore!, store, path, cursor, limit, fields)
	}

	return getFrontendState(frontendBridge!, store, path, cursor, limit, fields)
}
