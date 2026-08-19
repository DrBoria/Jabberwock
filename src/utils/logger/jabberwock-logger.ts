/**
 * @fileoverview Centralized global logger for Jabberwock notification/popup messages.
 *
 * ALL notification/popup-related console output must use this logger to ensure
 * consistent `[jabberwock]` prefix across the extension host.
 *
 * This is intentionally simple — it wraps console.log/warn/error with a
 * uniform prefix. For structured file-based logging, see `src/utils/logging/`.
 */

const PREFIX = "[jabberwock]"

export const jabberwockLog = {
	log: (...args: unknown[]) => {
		console.log(PREFIX, ...args)
	},
	warn: (...args: unknown[]) => {
		console.warn(PREFIX, ...args)
	},
	error: (...args: unknown[]) => {
		console.error(PREFIX, ...args)
	},
}
