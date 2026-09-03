import * as path from "node:path"

export type BindMode = "loopback" | "tun"

export interface ServerConfig {
	port: number
	bindAddress: string
	bindMode: BindMode
	dataDir: string
	workspaceRoot: string
	serveStatic: boolean
	staticDir: string
}

/**
 * Absolute path to the repo's `frontend/build` output.
 *
 * Resolved from the process working directory (the server runs from the repo root in both
 * dev and production). `import.meta.url` is intentionally avoided because the esbuild
 * `server.js` target bundles to CommonJS, where `import.meta.url` is unavailable.
 */
const defaultStaticDir = path.resolve(process.cwd(), "frontend/build")

/**
 * v4 Phase C1 (§7.2): parse server configuration from CLI args + env.
 *
 * Bind defaults to loopback for security; a non-loopback bind (NetBird TUN IP) must be
 * explicitly requested via `--bind tun` or `JABBERWOCK_BIND=tun` (§9.5 trust boundary).
 */
export function parseServerConfig(argv: string[], env: Record<string, string | undefined>): ServerConfig {
	const args = [...argv]
	const read = (flag: string): string | undefined => {
		const idx = args.indexOf(flag)
		return idx !== -1 ? args[idx + 1] : undefined
	}

	const bindMode = resolveBindMode(read, env)

	return {
		port: resolvePort(read, env),
		bindAddress: resolveBindAddress(bindMode, read, env),
		bindMode,
		dataDir: resolveDataDir(read, env),
		workspaceRoot: resolveWorkspaceRoot(read, env),
		serveStatic: args.includes("--serve-static") || env.JABBERWOCK_SERVE_STATIC === "1",
		staticDir: read("--static-dir") ?? defaultStaticDir,
	}
}

function resolveBindMode(
	read: (flag: string) => string | undefined,
	env: Record<string, string | undefined>,
): BindMode {
	return (read("--bind") ?? env.JABBERWOCK_BIND ?? "loopback") === "tun" ? "tun" : "loopback"
}

function resolvePort(read: (flag: string) => string | undefined, env: Record<string, string | undefined>): number {
	return Number(read("--port") ?? env.JABBERWOCK_SERVER_PORT ?? 3000)
}

function resolveDataDir(read: (flag: string) => string | undefined, env: Record<string, string | undefined>): string {
	return read("--data-dir") ?? env.DATA_DIR ?? path.join(process.cwd(), ".jabberwock-data")
}

function resolveWorkspaceRoot(
	read: (flag: string) => string | undefined,
	env: Record<string, string | undefined>,
): string {
	return read("--workspace") ?? env.JABBERWOCK_WORKSPACE ?? process.cwd()
}

/** Loopback is the only safe default; a TUN bind must be explicit (§7.2 / §9.5). */
function resolveBindAddress(
	bindMode: BindMode,
	read: (flag: string) => string | undefined,
	env: Record<string, string | undefined>,
): string {
	if (bindMode === "tun") {
		return read("--bind-address") ?? env.JABBERWOCK_BIND_ADDRESS ?? "0.0.0.0"
	}
	return "127.0.0.1"
}
