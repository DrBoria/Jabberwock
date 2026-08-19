import * as assert from "assert"
import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"

import { JabberwockEventName, type Notification } from "@jabberwock/types"

import { waitFor } from "../helpers/utils"
import { setDefaultSuiteTimeout } from "../helpers/test-utils"
import { setupTestHooks, getReadOnlyTaskConfig } from "./helpers/test-helpers"

suite.skip("Jabberwock list_files Tool", function () {
	setDefaultSuiteTimeout(this)

	let workspaceDir: string
	let testFiles: ReturnType<typeof createTestStructure>

	function createTestStructure(wsDir: string) {
		const dirName = `list-files-test-${Date.now()}`
		const testDir = path.join(wsDir, dirName)
		const nestedDir = path.join(testDir, "nested")
		const deepNestedDir = path.join(nestedDir, "deep")
		return {
			dirName,
			testDir,
			nestedDir,
			deepNestedDir,
			rootFile1: path.join(testDir, "root-file-1.txt"),
			rootFile2: path.join(testDir, "root-file-2.js"),
			nestedFile1: path.join(nestedDir, "nested-file-1.md"),
			nestedFile2: path.join(nestedDir, "nested-file-2.json"),
			deepNestedFile: path.join(deepNestedDir, "deep-nested-file.ts"),
			hiddenFile: path.join(testDir, ".hidden-file"),
			configFile: path.join(testDir, "config.yaml"),
			readmeFile: path.join(testDir, "README.md"),
		}
	}

	function createListFilesHandler() {
		const state = { taskCompleted: false, toolExecuted: false, listResults: null as string | null }
		let testId: string
		const mh = ({ message }: { message: Notification }) => {
			if (message.type === "say" && message.say === "api_req_started") {
				const text = message.text || ""
				if (text.includes("list_files")) {
					state.toolExecuted = true
					try {
						const jm = text.match(/\{"request":".*?"\}/)
						if (jm) {
							const d = JSON.parse(jm[0])
							if (d.request?.includes("Result:")) state.listResults = d.request as string
						}
					} catch {
						/* ignore */
					}
				}
			}
		}
		const ch = (id: string) => {
			if (id === testId) state.taskCompleted = true
		}
		return {
			state,
			mh,
			ch,
			setTestId: (id: string) => {
				testId = id
			},
		}
	}

	suiteSetup(async () => {
		const wf = vscode.workspace.workspaceFolders
		if (!wf?.length) throw new Error("No workspace folder found")
		workspaceDir = wf[0]!.uri.fsPath
		testFiles = createTestStructure(workspaceDir)
		await fs.mkdir(testFiles.nestedDir, { recursive: true })
		await fs.mkdir(testFiles.deepNestedDir, { recursive: true })
		await fs.writeFile(testFiles.rootFile1, "Root file 1 content")
		await fs.writeFile(testFiles.rootFile2, 'function testFunction() {\n\tconsole.log("Hello");\n}')
		await fs.writeFile(testFiles.nestedFile1, "# Nested File 1\n\nMarkdown file.")
		await fs.writeFile(testFiles.nestedFile2, '{"name":"nested-config","version":"1.0.0"}')
		await fs.writeFile(testFiles.deepNestedFile, "interface TestInterface { id: number; name: string; }")
		await fs.writeFile(testFiles.hiddenFile, "Hidden file content")
		await fs.writeFile(testFiles.configFile, "app:\n  name: test-app\n  version: 1.0.0")
		await fs.writeFile(testFiles.readmeFile, "# List Files Test Directory")
	})

	suiteTeardown(async () => {
		try {
			await globalThis.api.abortRunningTask()
		} catch {
			/* ignore */
		}
		try {
			await fs.rm(testFiles.testDir, { recursive: true, force: true })
		} catch {
			/* ignore */
		}
	})

	setupTestHooks()

	test("Should list files in a directory (non-recursive)", async function () {
		const api = globalThis.api
		const { state, mh, ch, setTestId } = createListFilesHandler()
		api.on(JabberwockEventName.Message, mh)
		api.on(JabberwockEventName.TaskCompleted, ch)

		let testId: string
		try {
			testId = await api.startNewTask(getReadOnlyTaskConfig(`List "${testFiles.dirName}" (non-recursive).`))
			setTestId(testId)
			await waitFor(() => state.taskCompleted, { timeout: 60_000 })
			assert.ok(state.toolExecuted, "list_files should have been executed")
			assert.ok(state.listResults, "Results should be captured")
			const r = state.listResults as string
			for (const f of ["root-file-1.txt", "root-file-2.js", "config.yaml", "README.md", ".hidden-file"])
				assert.ok(r.includes(f), `Should include ${f}`)
			assert.ok(r.includes("nested/"), "Should include directory nested/")
			for (const f of ["nested-file-1.md", "nested-file-2.json", "deep-nested-file.ts"])
				assert.ok(!r.includes(f), `Should NOT include ${f}`)
		} finally {
			api.off(JabberwockEventName.Message, mh)
			api.off(JabberwockEventName.TaskCompleted, ch)
		}
	})

	test("Should list files in a directory (recursive)", async function () {
		const api = globalThis.api
		const { state, mh, ch, setTestId } = createListFilesHandler()
		api.on(JabberwockEventName.Message, mh)
		api.on(JabberwockEventName.TaskCompleted, ch)

		let testId: string
		try {
			testId = await api.startNewTask(
				getReadOnlyTaskConfig(`List ALL contents of "${testFiles.dirName}" recursively (recursive=true).`),
			)
			setTestId(testId)
			await waitFor(() => state.taskCompleted, { timeout: 60_000 })
			assert.ok(state.toolExecuted, "list_files should have been executed")
			assert.ok(state.listResults, "Results should be captured")
		} finally {
			api.off(JabberwockEventName.Message, mh)
			api.off(JabberwockEventName.TaskCompleted, ch)
		}
	})

	test("Should list symlinked files and directories", async function () {
		const api = globalThis.api
		const { state, mh, ch, setTestId } = createListFilesHandler()
		api.on(JabberwockEventName.Message, mh)
		api.on(JabberwockEventName.TaskCompleted, ch)

		let testId: string
		try {
			const symlinkDir = `symlink-test-${Date.now()}`
			const testDir = path.join(workspaceDir, symlinkDir)
			await fs.mkdir(testDir, { recursive: true })
			const sourceDir = path.join(testDir, "source")
			await fs.mkdir(sourceDir, { recursive: true })
			await fs.writeFile(path.join(sourceDir, "source-file.txt"), "Content from symlinked file")
			try {
				await fs.symlink(path.join(sourceDir, "source-file.txt"), path.join(testDir, "link-to-file.txt"))
				await fs.symlink(sourceDir, path.join(testDir, "link-to-dir"))
			} catch {
				await fs.rm(testDir, { recursive: true, force: true })
				return
			}

			testId = await api.startNewTask(
				getReadOnlyTaskConfig(`List contents of "${symlinkDir}" (contains symlinks).`),
			)
			setTestId(testId)
			await waitFor(() => state.taskCompleted, { timeout: 60_000 })
			assert.ok(state.toolExecuted, "list_files should have been executed")
			assert.ok(state.listResults, "Results should be captured")
			const r = state.listResults as string
			assert.ok(
				r.includes("link-to-file.txt") || r.includes("source-file.txt"),
				"Should see symlink or target file",
			)
			assert.ok(r.includes("link-to-dir") || r.includes("source/"), "Should see symlink or target directory")
			await fs.rm(testDir, { recursive: true, force: true })
		} finally {
			api.off(JabberwockEventName.Message, mh)
			api.off(JabberwockEventName.TaskCompleted, ch)
		}
	})

	test("Should list files in workspace root directory", async function () {
		const api = globalThis.api
		const { state, mh, ch, setTestId } = createListFilesHandler()
		api.on(JabberwockEventName.Message, mh)
		api.on(JabberwockEventName.TaskCompleted, ch)

		let testId: string
		try {
			testId = await api.startNewTask(getReadOnlyTaskConfig(`Use list_files to list "." (current workspace).`))
			setTestId(testId)
			await waitFor(() => state.taskCompleted, { timeout: 60_000 })
			assert.ok(state.toolExecuted, "list_files should have been executed")
		} finally {
			api.off(JabberwockEventName.Message, mh)
			api.off(JabberwockEventName.TaskCompleted, ch)
		}
	})
})
