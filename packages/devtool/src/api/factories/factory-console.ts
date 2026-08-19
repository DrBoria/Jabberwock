import { diagnosticsManager } from "../../diagnostics/managers/DiagnosticsManager.js"
import { filterBackendLogs } from "./factory-helpers.js"
import type { FrontendBridge } from "../mst/types.js"

export async function handleGetConsole(
	params: {
		env: string
		level?: string
		limit?: number
		cursor?: number
		search?: string
	},
	frontendBridge?: FrontendBridge,
): Promise<string> {
	const { env, level, limit = 10, cursor = 0, search } = params
	if (limit > 10) throw new Error(`Limit cannot exceed 10, got ${limit}`)
	try {
		if (env === "backend") {
			const allLogs = diagnosticsManager.getAllLogs()
			const { lines, totalLines } = filterBackendLogs(allLogs, level, search, limit, cursor)
			return JSON.stringify({ lines, totalLines })
		}

		if (env === "frontend") {
			if (!frontendBridge) {
				return JSON.stringify({ lines: [], totalLines: 0 })
			}
			return frontendBridge.getConsoleLogs({ level, limit, cursor, search })
		}

		return JSON.stringify({ lines: [], totalLines: 0, error: `Unknown env: ${env}` })
	} catch (error) {
		return JSON.stringify({
			lines: [],
			totalLines: 0,
			error: error instanceof Error ? error.message : String(error),
		})
	}
}

export async function handleSearchConsole(
	params: {
		env?: string
		query: string
		level?: string
		limit?: number
		cursor?: number
	},
	frontendBridge?: FrontendBridge,
): Promise<string> {
	const { env, query, level, limit = 10, cursor = 0 } = params
	if (limit > 10) throw new Error(`Limit cannot exceed 10, got ${limit}`)
	try {
		const envs = env ? [env] : (["backend", "frontend"] as const)
		const searchEnv = async (e: string): Promise<{ lines: string[]; totalLines: number; env: string }> => {
			if (e === "backend") {
				const allLogs = diagnosticsManager.getAllLogs()
				const backendResult = filterBackendLogs(allLogs, level, query, limit, cursor)
				return { ...backendResult, env: "backend" }
			}
			if (!frontendBridge) {
				return { lines: [], totalLines: 0, env: "frontend" }
			}
			const frontendResult = await frontendBridge.searchConsole!({ query, level, limit, cursor })
			const parsed = JSON.parse(frontendResult) as { lines: string[]; totalLines: number }
			return { ...parsed, env: "frontend" }
		}

		const results = await Promise.all(envs.map(searchEnv))

		if (results.length === 1) {
			const single = results[0]!
			return JSON.stringify({ lines: single.lines, totalLines: single.totalLines })
		}

		const allLines = results.flatMap((r) => r.lines)
		const totalLines = results.reduce((sum, r) => sum + r.totalLines, 0)
		return JSON.stringify({ lines: allLines, totalLines })
	} catch (error) {
		return JSON.stringify({
			lines: [],
			totalLines: 0,
			error: error instanceof Error ? error.message : String(error),
		})
	}
}
