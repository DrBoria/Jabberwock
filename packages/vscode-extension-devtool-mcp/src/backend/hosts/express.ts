/**
 * Express entrypoint — mounts the Devtool MCP server lifecycle into an
 * Express app from a {@link DevtoolConfig}.
 *
 * This module is dependency-free: it uses minimal structural types that any
 * Express-compatible framework satisfies, so the package does not need to
 * install `express` itself.
 *
 * Usage:
 * ```ts
 * import { createDevtool, devtoolMiddleware } from "vscode-extension-devtool-mcp/express"
 *
 * const devtool = createDevtool({ provider, config })
 * await devtool.start()
 * app.use(devtoolMiddleware(devtool))
 * // on shutdown:
 * await devtool.stop()
 * ```
 */
import { DevtoolServer } from "../../mcp/server.js"
import { availableStoreEnvs, resolveConfig, type DevtoolConfig } from "../../mcp/config.js"
import type { DevtoolBridgeProvider } from "../../mcp/server.js"
import type { DevtoolModel } from "../../types.js"
import type { MessageInterceptor } from "../../mcp/interceptor/index.js"
import type { HostIdentity } from "../../mcp/transport/http.js"

// ── Minimal structural types (Express-compatible, no express import) ──────

export type DevtoolNextFunction = (err?: unknown) => void

export interface DevtoolRequest {
	[key: string]: unknown
}

export interface DevtoolResponse {
	locals: Record<string, unknown>
}

export type DevtoolMiddleware = (req: DevtoolRequest, res: DevtoolResponse, next: DevtoolNextFunction) => void

export interface ExpressDevtoolOptions {
	/** The host bridge provider (command execution, webview messaging). */
	provider: DevtoolBridgeProvider
	/** The devtool configuration (store adapters, ports). */
	config: DevtoolConfig
	/** Optional domain-specific model (registers extra MCP tools). */
	model?: DevtoolModel
	/** Optional message interceptor (event bus tools). */
	interceptor?: MessageInterceptor
	/** Optional target identity (window/workspace label for the status server). */
	identity?: HostIdentity
}

/**
 * Build a {@link DevtoolServer} instance from a config. The store adapters in the
 * config decide which state MCP tool environments are registered: a side
 * without a store adapter simply does not expose its state tools.
 */
export function createDevtool(options: ExpressDevtoolOptions): DevtoolServer {
	const resolved = resolveConfig(options.config)
	const storeEnvs = availableStoreEnvs(resolved)
	return new DevtoolServer(
		{ provider: options.provider, config: options.config },
		options.model,
		resolved.port,
		options.interceptor,
		resolved.statusPort,
		options.identity,
		storeEnvs,
	)
}

/**
 * Express middleware that attaches the running devtool instance to
 * `res.locals.devtool` so downstream handlers can query or control it.
 *
 * The middleware does NOT start or stop the devtool — call `devtool.start()`
 * once at app startup and `devtool.stop()` at shutdown.
 */
export function devtoolMiddleware(devtool: DevtoolServer): DevtoolMiddleware {
	return (_req, res, next) => {
		res.locals.devtool = devtool
		next()
	}
}
