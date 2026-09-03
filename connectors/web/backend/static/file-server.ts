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
 * v4 Phase C1 (§7.3): minimal static file server for the built SPA.
 *
 * Serves `frontend/build` when running as a single container (simple mode). In the
 * two-container topology nginx serves the SPA and this is disabled via the flag. SPA
 * fallback: unknown non-file paths return `index.html`.
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
		const url = new URL(requestUrl, "http://localhost")
		const filePath = path.normalize(path.join(this.rootDir, decodeURIComponent(url.pathname)))
		if (!filePath.startsWith(this.rootDir)) return null
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
		const servedPath =
			this.isServedFile(filePath) && fs.existsSync(filePath) ? filePath : path.join(this.rootDir, "index.html")
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
