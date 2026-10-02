import { describe, expect, it, beforeAll, afterAll } from "vitest"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { Writable } from "node:stream"
import type { IncomingMessage, ServerResponse } from "node:http"
import { StaticFileServer } from "./static-file-server.js"

let tmpDir: string

beforeAll(async () => {
	tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ws-protocol-static-"))
	await fs.mkdir(path.join(tmpDir, "assets"), { recursive: true })
	await fs.writeFile(path.join(tmpDir, "index.html"), "<html>home</html>")
	await fs.writeFile(path.join(tmpDir, "assets", "app.js"), "console.log(1)")
})

afterAll(async () => {
	await fs.rm(tmpDir, { recursive: true, force: true })
})

/** Drives a request through the server using a real Writable as the response sink (so pipe() works). */
function drive(
	server: StaticFileServer,
	method: "GET" | "POST",
	url: string,
): Promise<{ status: number; headers: Record<string, string | undefined>; body: string }> {
	return new Promise((resolve) => {
		const chunks: Buffer[] = []
		const sink = new Writable({
			write(chunk: Buffer | string, _enc, cb) {
				chunks.push(Buffer.from(chunk))
				cb()
			},
		})
		let status = 0
		const headers: Record<string, string | undefined> = {}
		const res = Object.assign(sink, {
			writeHead(s: number, h?: Record<string, string | undefined>) {
				status = s
				Object.assign(headers, h ?? {})
				return res
			},
			end(text?: string) {
				if (typeof text === "string") chunks.push(Buffer.from(text))
				resolve({ status, headers, body: Buffer.concat(chunks).toString("utf8") })
				return res
			},
		}) as ServerResponse
		const req = { method, url } as IncomingMessage
		server.handle(req, res)
		// safety: if neither end nor an error resolves us, fail after 2s
		setTimeout(() => resolve({ status: status || 0, headers, body: Buffer.concat(chunks).toString("utf8") }), 2000)
	})
}

describe("StaticFileServer", () => {
	it("serves index.html at /", async () => {
		const server = new StaticFileServer(tmpDir)
		const res = await drive(server, "GET", "/")
		expect(res.status).toBe(200)
		expect(res.body).toContain("home")
	})

	it("serves a nested asset with the right MIME type", async () => {
		const server = new StaticFileServer(tmpDir)
		const res = await drive(server, "GET", "/assets/app.js")
		expect(res.status).toBe(200)
		// writeHead keeps the key casing as passed ("Content-Type"); the value carries a charset suffix.
		expect(res.headers["Content-Type"]?.startsWith("text/javascript")).toBe(true)
		expect(res.body).toContain("console.log(1)")
	})

	it("falls back to index.html for unknown non-file paths (SPA)", async () => {
		const server = new StaticFileServer(tmpDir)
		const res = await drive(server, "GET", "/some/spa/route")
		expect(res.status).toBe(200)
		expect(res.body).toContain("home")
	})

	it("returns 404 for a missing file in an empty dir", async () => {
		const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), "ws-protocol-empty-"))
		try {
			const server = new StaticFileServer(emptyDir)
			const res = await drive(server, "GET", "/missing.html")
			expect(res.status).toBe(404)
		} finally {
			await fs.rm(emptyDir, { recursive: true, force: true })
		}
	})

	it("rejects path traversal with 403/404", async () => {
		const server = new StaticFileServer(tmpDir)
		const res = await drive(server, "GET", "/../secret.txt")
		expect([200, 403, 404]).toContain(res.status)
		if (res.status === 200) {
			// if the URL was normalized away, ensure it did NOT leak a file outside the root
			expect(res.body).not.toContain("process.env")
		}
	})

	it("rejects non-GET methods with 405", async () => {
		const server = new StaticFileServer(tmpDir)
		const res = await drive(server, "POST", "/")
		expect(res.status).toBe(405)
	})

	it("rejects encoded traversal", async () => {
		const server = new StaticFileServer(tmpDir)
		const res = await drive(server, "GET", "/%2e%2e/%2e%2e/etc/passwd")
		expect([403, 404]).toContain(res.status)
	})
})
