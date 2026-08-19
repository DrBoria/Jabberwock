import * as assert from "assert"
import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"

import { setDefaultSuiteTimeout } from "../helpers/test-utils"
import { abortRunningTask } from "./helpers/tool-test-helpers"
import { removeToolTestHandlers, startToolTask, waitForTask } from "./helpers/tool-test-helpers"
import { waitFor } from "../helpers/utils"

suite.skip("Jabberwock apply_diff Tool", function () {
	setDefaultSuiteTimeout(this)
	let workspaceDir: string

	const testFiles = {
		simpleModify: {
			name: `test-file-simple-${Date.now()}.txt`,
			content: "Hello World\nThis is a test file\nWith multiple lines",
			path: "",
		},
		multipleReplace: {
			name: `test-func-multiple-${Date.now()}.js`,
			content: `function calculate(x, y) {\n\tconst sum = x + y\n\tconst product = x * y\n\treturn { sum: sum, product: product }\n}`,
			path: "",
		},
		lineNumbers: {
			name: `test-lines-${Date.now()}.js`,
			content: `// Header comment\nfunction oldFunction() {\n\tconsole.log("Old implementation")\n}\n\n// Another function\nfunction keepThis() {\n\tconsole.log("Keep this")\n}\n\n// Footer comment`,
			path: "",
		},
		errorHandling: { name: `test-error-${Date.now()}.txt`, content: "Original content", path: "" },
		multiSearchReplace: {
			name: `test-multi-search-${Date.now()}.js`,
			content: `function processData(data) {\n\tconsole.log("Processing data")\n\treturn data.map(item => item * 2)\n}\n\nconst config = { timeout: 5000, retries: 3 }\n\nfunction validateInput(input) {\n\tconsole.log("Validating input")\n\tif (!input) throw new Error("Invalid input")\n\treturn true\n}`,
			path: "",
		},
	}

	suiteSetup(async function () {
		const ws = vscode.workspace.workspaceFolders
		if (!ws || ws.length === 0) throw new Error("No workspace folder found")
		workspaceDir = ws[0]!.uri.fsPath
		for (const [, file] of Object.entries(testFiles)) {
			file.path = path.join(workspaceDir, file.name)
			await fs.writeFile(file.path, file.content)
		}
	})

	suiteTeardown(async () => {
		await abortRunningTask()
		for (const [, file] of Object.entries(testFiles)) {
			try {
				await fs.unlink(file.path)
			} catch {
				/* ignore */
			}
		}
	})

	setup(async () => {
		await abortRunningTask()
	})
	teardown(async () => {
		await abortRunningTask()
	})

	test("Should apply diff to modify existing file content", async function () {
		const api = globalThis.api
		const testFile = testFiles.simpleModify
		const expectedContent = "Hello Universe\nThis is a test file\nWith multiple lines"
		const { taskId: _taskId, handlers } = await startToolTask(
			api,
			"apply_diff",
			`Use apply_diff on the file ${testFile.name} to change "Hello World" to "Hello Universe". The file already exists with this content:\n${testFile.content}`,
		)
		try {
			await waitForTask(handlers)
			const content = await fs.readFile(testFile.path, "utf-8")
			assert.strictEqual(handlers.toolExecuted, true, "apply_diff tool should have been executed")
			assert.strictEqual(content.trim(), expectedContent.trim(), "File content should be modified correctly")
		} finally {
			removeToolTestHandlers(api, handlers)
		}
	})

	test("Should apply multiple search/replace blocks in single diff", async function () {
		const api = globalThis.api
		const testFile = testFiles.multipleReplace
		const expectedContent = `function compute(a, b) {\n\tconst total = a + b\n\tconst result = a * b\n\treturn { total: total, result: result }\n}`
		const prompt = `Use apply_diff on the file ${testFile.name} to make ALL of these changes:
1. Rename function "calculate" to "compute"
2. Rename parameters "x, y" to "a, b"
3. Rename variable "sum" to "total" (including in the return statement)
4. Rename variable "product" to "result" (including in the return statement)
5. Change { sum: sum, product: product } to { total: total, result: result }
The file already exists.`
		const { taskId: _taskId, handlers } = await startToolTask(api, "apply_diff", prompt)
		try {
			await waitForTask(handlers)
			const content = await fs.readFile(testFile.path, "utf-8")
			assert.strictEqual(handlers.toolExecuted, true, "apply_diff tool should have been executed")
			assert.strictEqual(content.trim(), expectedContent.trim(), "All replacements should be applied correctly")
		} finally {
			removeToolTestHandlers(api, handlers)
		}
	})

	test("Should handle apply_diff with line number hints", async function () {
		const api = globalThis.api
		const testFile = testFiles.lineNumbers
		const expectedContent = `// Header comment\nfunction newFunction() {\n\tconsole.log("New implementation")\n}\n\n// Another function\nfunction keepThis() {\n\tconsole.log("Keep this")\n}\n\n// Footer comment`
		const { taskId: _taskId, handlers } = await startToolTask(
			api,
			"apply_diff",
			`Use apply_diff on the file ${testFile.name} to change "oldFunction" to "newFunction" and update its console.log to "New implementation". Keep the rest unchanged.`,
		)
		try {
			await waitForTask(handlers)
			const content = await fs.readFile(testFile.path, "utf-8")
			assert.strictEqual(handlers.toolExecuted, true, "apply_diff tool should have been executed")
			assert.strictEqual(content.trim(), expectedContent.trim(), "Only specified function should be modified")
		} finally {
			removeToolTestHandlers(api, handlers)
		}
	})

	test("Should handle apply_diff errors gracefully", async function () {
		const api = globalThis.api
		const testFile = testFiles.errorHandling
		const { taskId: _taskId, handlers } = await startToolTask(
			api,
			"apply_diff",
			`Use apply_diff on the file ${testFile.name} to replace "This content does not exist" with "New content".
The search pattern is NOT in the file. Only use apply_diff, if the search pattern is not found, report that it could not be found.`,
		)
		try {
			await waitFor(() => handlers.taskCompleted, { timeout: 90_000 })
			const content = await fs.readFile(testFile.path, "utf-8")
			assert.strictEqual(handlers.toolExecuted, true, "apply_diff tool should have been attempted")
			assert.strictEqual(content.trim(), testFile.content.trim(), "File content should remain unchanged")
		} finally {
			removeToolTestHandlers(api, handlers)
		}
	})

	test("Should apply multiple search/replace blocks to edit two separate functions", async function () {
		const api = globalThis.api
		const testFile = testFiles.multiSearchReplace
		const expectedContent = `function transformData(data) {\n\tconsole.log("Transforming data")\n\treturn data.map(item => item * 2)\n}\n\nconst config = { timeout: 5000, retries: 3 }\n\nfunction checkInput(input) {\n\tconsole.log("Checking input")\n\tif (!input) throw new Error("Invalid input")\n\treturn true\n}`
		const prompt = `Use apply_diff on the file ${testFile.name} with TWO SEPARATE search/replace blocks in a SINGLE apply_diff call:
BLOCK 1: Edit processData to rename to "transformData" and change "Processing data" to "Transforming data"
BLOCK 2: Edit validateInput to rename to "checkInput" and change "Validating input" to "Checking input"
Use multiple SEARCH/REPLACE blocks in one apply_diff call, NOT multiple calls.`
		const { taskId: _taskId, handlers } = await startToolTask(api, "apply_diff", prompt)
		try {
			await waitForTask(handlers)
			const content = await fs.readFile(testFile.path, "utf-8")
			assert.strictEqual(handlers.toolExecuted, true, "apply_diff tool should have been executed")
			assert.strictEqual(content.trim(), expectedContent.trim(), "Both functions should be modified")
		} finally {
			removeToolTestHandlers(api, handlers)
		}
	})
})
