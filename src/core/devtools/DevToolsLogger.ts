import { diagnosticsManager } from "./DiagnosticsManager"

/**
 * Utility class to track and log tool execution performance and results.
 * Integrated with DiagnosticsManager for DevTools observability.
 */
export class DevToolsLogger {
	/**
	 * Tracks execution of a tool function and records metrics.
	 * @param toolName Name of the tool being executed
	 * @param agentId The ID/Role of the agent using the tool
	 * @param executeFn The actual execution logic
	 * @returns The result of executeFn
	 */
	static async track<T>(toolName: string, agentId: string, executeFn: () => Promise<T>): Promise<T> {
		const startTime = Date.now()
		const timestamp = new Date().toISOString()

		try {
			const result = await executeFn()
			const durationMs = Date.now() - startTime

			// record to diagnostics manager for real-time tracking in DevTools UI
			diagnosticsManager.recordMstPatch({
				op: "add",
				path: `/toolLogs/${startTime}`, // Mock path for now to show tracking intent
				value: {
					toolName,
					agentId,
					durationMs,
					timestamp,
					status: "success",
				},
			})

			return result
		} catch (error) {
			const durationMs = Date.now() - startTime
			const errorMessage = error instanceof Error ? error.message : String(error)

			diagnosticsManager.recordMstPatch({
				op: "add",
				path: `/toolLogs/${startTime}`,
				value: {
					toolName,
					agentId,
					durationMs,
					timestamp,
					status: "failed",
					error: errorMessage,
				},
			})

			throw error
		}
	}
}
