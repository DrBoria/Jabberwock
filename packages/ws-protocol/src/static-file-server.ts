import * as fs from "node:fs"
import * as http from "node:http"
import * as path from "node:path"

const MIME_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".map": "application/json; charset=utf-8",
}

/**
 * v4 single-state (§4.2): minimal static file server for the built SPA.
 *
 * Serves `frontend/build` so the host that owns the backend (standalone server in
 * production, the vscode extension host in dev) can hand the browser the SPA without
 * a second process. SPA fallback: unknown non-file paths return `index.html`.
 */
export class StaticFileServer {
	constructor(private readonly rootDir: string) {}

	/** Returns true if the request was handled (a file was served or an error written). */
	handle(req: http.IncomingMessage, res: http.ServerResponse): boolean {
		if (req.method !== "GET" && req.method !== "HEAD") {
			this.writeText(res, 405, "Method Not Allowed")
			return true
		}

		const filePath = this.resolvePath(req.url ?? "/")
		if (filePath === null) {
			this.writeText(res, 403, "Forbidden")
			return true
		}

		if (!this.isServedFile(filePath)) {
			this.writeText(res, 404, "Not Found")
			return true
		}

		this.streamFile(req, res, filePath)
		return true
	}

	/** Resolve the request URL to a file path inside the root, or null when outside it. */
	private resolvePath(requestUrl: string): string | null {
		// Strip query string, then decode percent-encoding WITHOUT URL normalization.
		// Using `new URL()` would resolve `..` segments before we can check containment,
		// allowing traversal (e.g. `/%2e%2e/%2e%2e/etc/passwd` → `/etc/passwd`).
		const qIdx = requestUrl.indexOf("?")
		const pathOnly = qIdx === -1 ? requestUrl : requestUrl.slice(0, qIdx)
		let decoded: string
		try {
			decoded = decodeURIComponent(pathOnly)
		} catch {
			return null // invalid percent-encoding
		}
		const filePath = path.normalize(path.join(this.rootDir, decoded))
		// Containment check: must equal rootDir or be strictly inside it.
		if (filePath !== this.rootDir && !filePath.startsWith(this.rootDir + path.sep)) return null
		return filePath
	}

	/** True when the path maps to an existing file (with SPA fallback to index.html). */
	private isServedFile(filePath: string): boolean {
		if (filePath === this.rootDir || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
			return fs.existsSync(path.join(this.rootDir, "index.html"))
		}
		return true
	}

	private streamFile(req: http.IncomingMessage, res: http.ServerResponse, filePath: string): void {
		// Only a real file may be streamed — directories (e.g. "/") fall back to index.html,
		// otherwise createReadStream(dir) crashes the process with EISDIR.
		const isRealFile = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
		const servedPath = isRealFile ? filePath : path.join(this.rootDir, "index.html")
		const ext = path.extname(servedPath).toLowerCase()
		const contentType = MIME_TYPES[ext] ?? "application/octet-stream"
		const stat = fs.statSync(servedPath)
		res.writeHead(200, {
			"Content-Type": contentType,
			"Content-Length": stat.size,
			"Cache-Control": "no-cache",
		})
		if (req.method === "HEAD") {
			res.end()
			return
		}
		fs.createReadStream(servedPath).pipe(res)
	}

	private writeText(res: http.ServerResponse, status: number, text: string): void {
		res.writeHead(status, { "Content-Type": "text/plain" })
		res.end(text)
	}
}
