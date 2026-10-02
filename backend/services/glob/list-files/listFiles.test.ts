import * as childProcess from "child_process"
import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"

import { listFiles } from "./main"

// Best-effort discovery of a system ripgrep for the "rg available" test.
let SYSTEM_RG: string | undefined
try {
	SYSTEM_RG = childProcess.execSync("which rg", { encoding: "utf-8" }).trim() || undefined
} catch {
	SYSTEM_RG = undefined
}

// getRipgrepPath honors a JABBERWOCK_RG_PATH override (empty string forces the
// "no ripgrep" fallback). This lets the tests exercise both branches without
// mocking modules (vi.mock of ./ripgrep is not intercepted here because
// main.ts destructures the import).
const RG_ENV = "JABBERWOCK_RG_PATH"
// NOTE: the sandbox must NOT live under /tmp — DIRS_TO_IGNORE contains
// "tmp"/"temp", and the ripgrep globs (`-g !**/tmp/**`) would exclude the
// entire sandbox. Use a dedicated dir under the home folder instead.
const SANDBOX_ROOT = path.join(os.homedir(), ".jabberwock-rg-test")

describe("listFiles — ripgrep graceful degrade (BUG-3)", () => {
	let tmpDir: string

	beforeEach(async () => {
		await fs.mkdir(SANDBOX_ROOT, { recursive: true })
		tmpDir = await fs.mkdtemp(path.join(SANDBOX_ROOT, "rg-degrade-"))
		await fs.mkdir(path.join(tmpDir, "src"), { recursive: true })
		await fs.mkdir(path.join(tmpDir, "src", "nested"), { recursive: true })
		await fs.mkdir(path.join(tmpDir, "node_modules"), { recursive: true })
		await fs.mkdir(path.join(tmpDir, ".git"), { recursive: true })
		await fs.writeFile(path.join(tmpDir, "README.md"), "hi")
		await fs.writeFile(path.join(tmpDir, "src", "a.ts"), "a")
		await fs.writeFile(path.join(tmpDir, "src", "nested", "b.ts"), "b")
		await fs.writeFile(path.join(tmpDir, "node_modules", "dep.js"), "dep")
		await fs.writeFile(path.join(tmpDir, ".git", "config"), "git")
	})

	afterEach(async () => {
		delete process.env[RG_ENV]
		await fs.rm(tmpDir, { recursive: true, force: true })
	})

	// Best-effort cleanup of the sandbox root on a failed run
	afterAll(async () => {
		await fs.rm(SANDBOX_ROOT, { recursive: true, force: true }).catch(() => undefined)
	})

	it("does not throw when ripgrep is missing and falls back to a plain FS scan", async () => {
		process.env[RG_ENV] = ""

		const [files, limitReached] = await listFiles(tmpDir, true, 100)

		expect(limitReached).toBe(false)

		const rel = files.map((f) => path.relative(tmpDir, f).split(path.sep).join("/"))
		expect(rel).toContain("README.md")
		expect(rel).toContain("src/a.ts")
		expect(rel).toContain("src/nested/b.ts")

		// Ignored directories are excluded from the fallback scan
		expect(rel.some((f) => f.startsWith("node_modules/"))).toBe(false)
		expect(rel.some((f) => f.startsWith(".git/"))).toBe(false)
	})

	it("still uses ripgrep when the binary is available", async () => {
		if (!SYSTEM_RG) {
			return // no system rg on this machine — skip
		}
		process.env[RG_ENV] = SYSTEM_RG

		const [files] = await listFiles(tmpDir, true, 100)

		const rel = files.map((f) => path.relative(tmpDir, f).split(path.sep).join("/"))
		expect(rel).toContain("README.md")
		expect(rel).toContain("src/a.ts")
	})

	it("respects the limit in the fallback scan", async () => {
		process.env[RG_ENV] = ""

		const [files] = await listFiles(tmpDir, true, 2)

		expect(files.length).toBeLessThanOrEqual(2)
	})
})
