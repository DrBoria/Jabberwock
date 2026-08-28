/**
 * Module-level backend logger slot (plan §4.2 / L8).
 *
 * Replaces the static `EventBridge.outputChannel` field (~35 writer files): bootstrap calls
 * `setBackendLogger(caps.logger)` once at startup; every other module imports `{ log }` from here.
 * In vscode mode the slot is backed by an OutputChannel adapter (built in extension activation);
 * in server mode it falls back to console output — same call sites, zero host types involved.
 */

export interface BackendLogger {
	info(...args: unknown[]): void
	warn(...args: unknown[]): void
}

const CONSOLE_LOGGER: BackendLogger = {
	info: (...args) => console.log("[jabberwock]", ...args),
	warn: (...args) => console.warn("[jabberwock]", ...args),
}

let current: BackendLogger = CONSOLE_LOGGER

/** Install the process-wide backend logger (called once during bootstrap). */
export function setBackendLogger(logger: BackendLogger): void {
	current = logger
}

/** Current backend logger; falls back to console until `setBackendLogger` is called. */
export const log: BackendLogger = {
	info(...args) {
		return current.info(...args)
	},
	warn(...args) {
		return current.warn(...args)
	},
}
