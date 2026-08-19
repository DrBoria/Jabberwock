/**
 * @fileoverview Centralized global logger for Jabberwock notification/popup messages.
 *
 * ALL notification/popup-related console output must use this logger to ensure
 * consistent `[jabberwock]` prefix across the webview UI.
 *
 * This is intentionally simple — it wraps console.log/warn/error with a
 * uniform prefix.
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
