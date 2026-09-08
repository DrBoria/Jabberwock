import { getBackendLogger } from "@features/foundation/capabilities/registry"

export type LogFunction = (...args: unknown[]) => void

/**
 * Creates a logging function that writes to a VSCode output channel
 * Based on the outputChannelLog implementation from src/extension/api.ts
 */
export function createOutputChannelLogger(): LogFunction {
	return (...args: unknown[]) => {
		for (const arg of args) {
			if (arg === null) {
				getBackendLogger().appendLine("null")
			} else if (arg === undefined) {
				getBackendLogger().appendLine("undefined")
			} else if (typeof arg === "string") {
				getBackendLogger().appendLine(arg)
			} else if (arg instanceof Error) {
				getBackendLogger().appendLine(`Error: ${arg.message}\n${arg.stack || ""}`)
			} else {
				try {
					getBackendLogger().appendLine(
						JSON.stringify(
							arg,
							(key, value) => {
								if (typeof value === "bigint") return `BigInt(${value})`
								if (typeof value === "function") return `Function: ${value.name || "anonymous"}`
								if (typeof value === "symbol") return value.toString()
								return value
							},
							2,
						),
					)
				} catch (_error) {
					getBackendLogger().appendLine(`[Non-serializable object: ${Object.prototype.toString.call(arg)}]`)
				}
			}
		}
	}
}

/**
 * Creates a logging function that logs to both the output channel and console
 * Following the pattern from src/extension/api.ts
 */
export function createDualLogger(outputChannelLog: LogFunction): LogFunction {
	return (...args: unknown[]) => {
		outputChannelLog(...args)
		console.log(...args)
	}
}
