/**
 * NestJS entrypoint — a `NestMiddleware`-compatible class plus a factory that
 * builds a {@link DevtoolServer} from a {@link DevtoolConfig}.
 *
 * This module is dependency-free: it uses minimal structural types that any
 * NestJS-compatible framework satisfies, so the package does not need to
 * install `@nestjs/common` itself.
 *
 * Usage:
 * ```ts
 * import { DevtoolNestMiddleware, createDevtool } from "vscode-extension-devtool-mcp/nest"
 *
 * const devtool = createDevtool({ provider, config })
 * // in a NestJS module:
 * //   forRoutes(...) with DevtoolNestMiddleware, injecting the instance.
 * ```
 */
import { DevtoolServer } from "../../mcp/server.js"
import { availableStoreEnvs, resolveConfig, type DevtoolConfig } from "../../mcp/config.js"
import type { DevtoolBridgeProvider } from "../../mcp/server.js"
import type { DevtoolModel } from "../../types.js"
import type { MessageInterceptor } from "../../mcp/interceptor/index.js"
import type { HostIdentity } from "../../mcp/transport/http.js"

// ── Minimal structural types (NestJS-compatible, no @nestjs/common import) ─

export type NestNextFunction = (err?: unknown) => void

export interface NestRequest {
	[key: string]: unknown
}

export interface NestResponse {
	[key: string]: unknown
}

/**
 * A NestJS-compatible middleware class. Assign the devtool instance via the
 * constructor (e.g. from a DI provider) and register it with `app.use(...)`.
 */
export class DevtoolNestMiddleware {
	constructor(private readonly devtool: DevtoolServer) {}

	use(_req: NestRequest, res: NestResponse, next: NestNextFunction): void {
		res.devtool = this.devtool
		next()
	}
}

export interface NestDevtoolOptions {
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
 * config decide which state MCP tool environments are registered.
 */
export function createDevtool(options: NestDevtoolOptions): DevtoolServer {
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
