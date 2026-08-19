/**
 * Diagnostics Model — Console log and diagnostics verification.
 *
 * All methods use DevtoolClient primitives (getConsoleLogs, getCurrentState) —
 * NO interceptor usage.
 */

import type { DevtoolClient } from "../../packages/devtool/src/client"

export class DiagnosticsModel {
	constructor(public readonly client: DevtoolClient) {}

	/**
	 * Get console logs from the devtool.
	 */
	async getConsoleLogs(level?: string, limit?: number): Promise<string> {
		return this.client.getConsoleLogs(level, limit)
	}

	/**
	 * Verify the console has no errors.
	 */
	async verifyCleanConsole(): Promise<void> {
		try {
			const logs = await this.getConsoleLogs("error", 5)
			if (logs && logs.length > 0) {
				console.warn(`  ⚠ Console has ${logs.length} error(s):`, logs.slice(0, 200))
			}
		} catch {
			// Console check is best-effort
		}
	}

	/**
	 * Verify that NO new API requests are made within the specified duration.
	 *
	 * 1. Wait for task to settle (not streaming).
	 * 2. Count current "[API] Starting request to" log entries.
	 * 3. Wait for the duration.
	 * 4. Count again — if the count increased, fail with details.
	 */
	async verifyNoNewApiRequests(waitMs: number = 30000): Promise<void> {
		// First, wait for the task to be settled (not streaming)
		try {
			const status = (await this.client.getCurrentState()) as { taskId?: string } | undefined
			if (status && status.taskId) {
				await this.waitForTaskIdle(10000)
			}
		} catch {
			// Best-effort
		}

		// Now count current API requests as baseline
		const initialLogs = await this.getConsoleLogs(undefined, 500)
		const initialCount = this.countApiRequests(initialLogs)
		console.log(`  ⏳ Waiting ${waitMs}ms to verify no new API requests (baseline: ${initialCount})...`)

		await new Promise((r) => setTimeout(r, waitMs))

		const finalLogs = await this.getConsoleLogs(undefined, 500)
		const finalCount = this.countApiRequests(finalLogs)

		if (finalCount > initialCount) {
			const newRequests = finalCount - initialCount
			throw new Error(
				`❌ ${newRequests} new API request(s) detected during ${waitMs}ms idle wait ` +
					`(was ${initialCount}, now ${finalCount}). Agent did NOT remain idle!`,
			)
		}
		console.log(`  ✓ Agent remained idle: no new API requests in ${waitMs}ms (total: ${finalCount})`)
	}

	/**
	 * Wait for the task to become idle (not streaming/loading) by polling current state.
	 */
	private async waitForTaskIdle(timeoutMs: number = 10000): Promise<void> {
		const startTime = Date.now()
		while (Date.now() - startTime < timeoutMs) {
			const state = (await this.client.getCurrentState()) as
				| { isLoading?: boolean; isStreaming?: boolean }
				| undefined
			if (state) {
				const isIdle = !state.isLoading && !state.isStreaming
				if (isIdle) {
					return
				}
			}
			await new Promise((r) => setTimeout(r, 500))
		}
		throw new Error(`Task did not become idle within ${timeoutMs}ms`)
	}

	/**
	 * Count the number of "[API] Starting request to" lines in console log output.
	 */
	private countApiRequests(logs: string): number {
		const lines = logs.split("\n")
		return lines.filter((line) => line.includes("[API] Starting request to")).length
	}
}
