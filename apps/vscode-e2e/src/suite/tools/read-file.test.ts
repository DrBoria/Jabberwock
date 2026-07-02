import * as assert from "assert"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import * as vscode from "vscode"

import { JabberwockEventName, type Notification } from "@jabberwock/types"

import { waitFor, sleep } from "../helpers/utils"
import { setDefaultSuiteTimeout } from "../helpers/test-utils"

suite.skip("Jabberwock read_file Tool", function () {
	setDefaultSuiteTimeout(this)

	let tempDir: string
	let workspaceDir: string
	let testFiles!: Record<string, string>

	suiteSetup(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "jabberwock-test-read-"))
		workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || tempDir
		const ts = Date.now()
		testFiles = {
			simple: path.join(workspaceDir, `simple-${ts}.txt`),
			multiline: path.join(workspaceDir, `multiline-${ts}.txt`),
			large: path.join(workspaceDir, `large-${ts}.txt`),
			xmlContent: path.join(workspaceDir, `xml-${ts}.xml`),
			nested: path.join(workspaceDir, "nested", "deep", `nested-${ts}.txt`),
		}
		await fs.writeFile(testFiles.$1!, "Hello, World!")
		await fs.writeFile(testFiles.$1!, "Line 1\nLine 2\nLine 3\nLine 4\nLine 5")
		await fs.writeFile(
			testFiles.large!,
			Array.from({ length: 100 }, (_, i) => `Line ${i + 1}: test content`).join("\n"),
		)
		await fs.writeFile(testFiles.xmlContent!, "<root>\n  <child>Test content</child>\n</root>")
		await fs.mkdir(path.dirname(testFiles.nested!), { recursive: true })
		await fs.writeFile(testFiles.nested!, "Content in nested directory")
	})

	suiteTeardown(async () => {
		try {
			await globalThis.api.abortRunningTask()
		} catch {
			/* ignore */
		}
		for (const fp of Object.values(testFiles)) {
			try {
				await fs.unlink(fp!)
			} catch {
				/* ignore */
			}
		}
		try {
			await fs.rmdir(path.dirname(testFiles.nested!))
		} catch {
			/* ignore */
		}
		try {
			await fs.rmdir(path.dirname(path.dirname(testFiles.nested!)))
		} catch {
			/* ignore */
		}
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	setup(async () => {
		try {
			await globalThis.api.abortRunningTask()
		} catch {
			/* ignore */
		}
		await sleep(100)
	})
	teardown(async () => {
		try {
			await globalThis.api.abortRunningTask()
		} catch {
			/* ignore */
		}
		await sleep(100)
	})

	function runReadTest(desc: string, text: string, assertFn: (toolExecuted: boolean) => void) {
		test(desc, async function () {
			const api = globalThis.api
			let taskCompleted = false
			let toolExecuted = false
			const mh = ({ message }: { message: Notification }) => {
				if (
					message.type === "say" &&
					message.say === "api_req_started" &&
					(message.text || "").includes("read_file")
				)
					toolExecuted = true
			}
			const ch = (id: string) => {
				if (id === testId) taskCompleted = true
			}
			api.on(JabberwockEventName.Message, mh)
			api.on(JabberwockEventName.TaskCompleted, ch)

			let testId: string
			try {
				testId = await api.startNewTask({
					configuration: {
						mode: "code",
						autoApprovalEnabled: true,
						alwaysAllowReadOnly: true,
						alwaysAllowReadOnlyOutsideWorkspace: true,
					},
					text,
				})
				await waitFor(() => taskCompleted, { timeout: 60_000 })
				assertFn(toolExecuted)
			} finally {
				api.off(JabberwockEventName.Message, mh)
				api.off(JabberwockEventName.TaskCompleted, ch)
			}
		})
	}

	runReadTest(
		"Should read a simple text file",
		`Read "${path.basename(testFiles.simple!)}" and tell me what it contains.`,
		(te) => assert.ok(te, "read_file should have been executed"),
	)
	runReadTest(
		"Should read a multiline file",
		`Read "${path.basename(testFiles.multiline!)}" and count its lines.`,
		(te) => assert.ok(te, "read_file should have been executed"),
	)
	runReadTest(
		"Should read file with slice offset/limit",
		`Read "${path.basename(testFiles.multiline!)}" slice mode offset=2 limit=3.`,
		(te) => assert.ok(te, "read_file should have been executed"),
	)
	runReadTest("Should handle reading non-existent file", `Try to read "${`non-existent-${Date.now()}.txt`}".`, (te) =>
		assert.ok(te, "read_file should have been executed"),
	)
	runReadTest("Should read XML content file", `Read XML "${path.basename(testFiles.xmlContent!)}".`, (te) =>
		assert.ok(te, "read_file should have been executed"),
	)
	runReadTest(
		"Should read multiple files in sequence",
		`Read "${path.basename(testFiles.simple!)}" and "${path.basename(testFiles.multiline!)}".`,
		(te) => assert.ok(te, "read_file should have been executed"),
	)
	runReadTest("Should read large file efficiently", `Read "${path.basename(testFiles.large!)}" (100 lines).`, (te) =>
		assert.ok(te, "read_file should have been executed"),
	)
})
