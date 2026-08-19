import * as assert from "assert"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

import { setDefaultSuiteTimeout } from "../helpers/test-utils"
import { findFileInWorkspace, cleanupFile, abortRunningTask, runToolTest } from "./helpers/tool-test-helpers"

suite.skip("Jabberwock write_to_file Tool", function () {
	setDefaultSuiteTimeout(this)

	let tempDir: string
	let testFilePath: string

	suiteSetup(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "jabberwock-test-"))
	})

	suiteTeardown(async () => {
		await abortRunningTask()
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	setup(async () => {
		await abortRunningTask()
		testFilePath = path.join(tempDir, `test-file-${Date.now()}.txt`)
	})

	teardown(async () => {
		await abortRunningTask()
		await cleanupFile(testFilePath)
	})

	test("Should create a new file with content", async function () {
		const api = globalThis.api
		const fileContent = "Hello, this is a test file!"
		const baseFileName = path.basename(testFilePath)

		await runToolTest(
			api,
			"write_to_file",
			`Create a file named "${baseFileName}" with the following content:\n${fileContent}`,
			async (handlers) => {
				const result = await findFileInWorkspace(baseFileName, tempDir)
				assert.ok(result, `File should have been created. Expected filename: ${baseFileName}`)
				assert.strictEqual(result.content.trim(), fileContent, "File content should match expected content")
				assert.ok(handlers.toolExecuted, "write_to_file tool should have been executed")
			},
		)
	})

	test("Should create nested directories when writing file", async function () {
		const api = globalThis.api
		const content = "File in nested directory"
		const fileName = `file-${Date.now()}.txt`
		const _nestedPath = path.join("nested", "deep", "directory", fileName)

		await runToolTest(
			api,
			"write_to_file",
			`Create a file named "${fileName}" in a nested directory structure "nested/deep/directory/" with the following content:\n${content}`,
			async () => {
				const result = await findFileInWorkspace(fileName, tempDir)
				assert.ok(result, `File should have been created. Expected filename: ${fileName}`)
				assert.strictEqual(result.content.trim(), content, "File content should match")
			},
		)
	})
})
