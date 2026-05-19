/**
 * Webview Console Bridge — intercepts console.log/warn/error/debug and forwards
 * them as webviewLog messages to the extension host for diagnostics.
 *
 * Originally from webview-ui/src/features/devtools/utils/webviewConsoleBridge.ts,
 * moved into @jabberwock/devtool so the package is self-contained.
 */

import { vscode } from "./vscode.js"

const originalConsole = {
	log: console.log.bind(console),
	warn: console.warn.bind(console),
	error: console.error.bind(console),
	debug: console.debug.bind(console),
}

const LOG_METHODS = ["log", "warn", "error", "debug"] as const

const serializeArg = (arg: unknown) => {
	if (arg instanceof Error) return arg.stack || arg.message
	if (typeof arg === "object" && arg !== null) {
		// Detect React-like objects or components
		if ("displayName" in arg && typeof arg.displayName === "string") return `<${arg.displayName}>`
		if ("name" in arg && typeof arg.name === "string") return `<${arg.name}>`
		if ("$$typeof" in arg) return "[React Element]"
		try {
			return JSON.stringify(arg)
		} catch {
			return String(arg)
		}
	}
	return String(arg)
}

/**
 * Initialize the webview console bridge.
 * Call this once at app startup to intercept console methods.
 */
export function initWebviewConsoleBridge() {
	LOG_METHODS.forEach((method) => {
		const original = originalConsole[method]
		Object.defineProperty(console, method, {
			value: (...args: unknown[]) => {
				original(...args)

				try {
					let messageStr = ""
					if (typeof args[0] === "string" && args[0].includes("%s")) {
						let formatStr = args[0]
						const formatArgs = args.slice(1)
						formatArgs.forEach((arg) => {
							formatStr = formatStr.replace("%s", serializeArg(arg))
						})
						messageStr = formatStr
					} else {
						messageStr = args.map(serializeArg).join(" ")
					}
					vscode.postMessage({
						type: "webviewLog",
						text: `[WEBVIEW][${method.toUpperCase()}] ${messageStr}`,
					} as never)
				} catch {
					// Serialization safety — never break the caller
				}
			},
			writable: true,
			configurable: true,
		})
	})
}
