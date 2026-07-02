import { debugLog } from "./utils.ts"

export class DebugLogger {
	private component: string

	constructor(component: string) {
		this.component = component
	}

	debug(message: string, data?: unknown): void {
		debugLog(`[${this.component}] ${message}`, data)
	}

	info(message: string, data?: unknown): void {
		this.debug(message, data)
	}

	warn(message: string, data?: unknown): void {
		debugLog(`[${this.component}] WARN: ${message}`, data)
	}

	error(message: string, data?: unknown): void {
		debugLog(`[${this.component}] ERROR: ${message}`, data)
	}
}

export const providerDebugLog = new DebugLogger("ProviderSettings")
