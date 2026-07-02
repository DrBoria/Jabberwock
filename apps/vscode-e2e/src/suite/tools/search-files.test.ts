import * as assert from "assert"
import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"

import { JabberwockEventName, type Notification } from "@jabberwock/types"

import { waitFor } from "../helpers/utils"
import { setDefaultSuiteTimeout } from "../helpers/test-utils"
import { setupTestHooks, getReadOnlyTaskConfig } from "./helpers/test-helpers"

suite.skip("Jabberwock search_files Tool", function () {
	setDefaultSuiteTimeout(this)

	let workspaceDir: string
	let testFiles: Record<string, string>

	function createSearchHandler(extraCheck?: (text: string) => boolean) {
		const state = { taskCompleted: false, toolExecuted: false }
		let testId: string
		const mh = ({ message }: { message: Notification }) => {
			if (message.type === "say" && message.say === "api_req_started") {
				const text = message.text || ""
				if (text.includes("search_files") && (!extraCheck || extraCheck(text))) state.toolExecuted = true
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
		const ts = Date.now()
		testFiles = {
			jsFile: path.join(workspaceDir, `test-search-${ts}.js`),
			tsFile: path.join(workspaceDir, `test-search-${ts}.ts`),
			jsonFile: path.join(workspaceDir, `test-config-${ts}.json`),
			configFile: path.join(workspaceDir, `app-config-${ts}.yaml`),
		}
		await fs.writeFile(
			testFiles.jsFile!,
			'function total(items){return items.reduce((s,i)=>s+i.price,0)}\nfunction validate(u){if(!u.email)throw Error("bad");return true}\n// TODO: add more\nconst API_URL="https://api.example.com"\nexport{total,validate}',
		)
		await fs.writeFile(
			testFiles.tsFile!,
			'interface User{id:number;name:string;email:string;isActive:boolean}\ninterface Product{id:number;title:string;price:number;category:string}\nclass UserService{async getUser(id:number):Promise<User>{// TODO: implement\nthrow new Error("NI")}}\nexport{User,Product,UserService}',
		)
		await fs.writeFile(
			testFiles.jsonFile!,
			'{"name":"test-app","version":"1.0.0","scripts":{"start":"node index.js","test":"jest"},"dependencies":{"express":"^4.18.0"}}',
		)
		await fs.writeFile(testFiles.configFile!, 'app:\n  name: "Test App"\n  version: "1.0.0"\n  port: 3000')
	})

	suiteTeardown(async () => {
		try {
			await globalThis.api.abortRunningTask()
		} catch {
			/* ignore */
		}
		for (const fp of Object.values(testFiles)) {
			try {
				await fs.unlink(fp)
			} catch {
				/* ignore */
			}
		}
	})

	setupTestHooks()

	test("Should search for function definitions in JavaScript files", async function () {
		const api = globalThis.api
		const { state, mh, ch, setTestId } = createSearchHandler()
		api.on(JabberwockEventName.Message, mh)
		api.on(JabberwockEventName.TaskCompleted, ch)

		let testId: string
		try {
			testId = await api.startNewTask(getReadOnlyTaskConfig(`Search regex "function\\\\s+\\\\w+" in JS files.`))
			setTestId(testId)
			await waitFor(() => state.taskCompleted, { timeout: 60_000 })
			assert.ok(state.toolExecuted, "search_files should have been executed")
		} finally {
			api.off(JabberwockEventName.Message, mh)
			api.off(JabberwockEventName.TaskCompleted, ch)
		}
	})

	test("Should search for TODO comments across multiple file types", async function () {
		const api = globalThis.api
		const { state, mh, ch, setTestId } = createSearchHandler()
		api.on(JabberwockEventName.Message, mh)
		api.on(JabberwockEventName.TaskCompleted, ch)

		let testId: string
		try {
			testId = await api.startNewTask(getReadOnlyTaskConfig(`Search regex "TODO.*" across all files.`))
			setTestId(testId)
			await waitFor(() => state.taskCompleted, { timeout: 60_000 })
			assert.ok(state.toolExecuted, "search_files should have been executed")
		} finally {
			api.off(JabberwockEventName.Message, mh)
			api.off(JabberwockEventName.TaskCompleted, ch)
		}
	})

	test("Should search with file pattern filter for TypeScript files", async function () {
		const api = globalThis.api
		const { state, mh, ch, setTestId } = createSearchHandler((t) => t.includes("*.ts"))
		api.on(JabberwockEventName.Message, mh)
		api.on(JabberwockEventName.TaskCompleted, ch)

		let testId: string
		try {
			testId = await api.startNewTask(
				getReadOnlyTaskConfig(`Search regex "(interface|class)\\\\s+\\\\w+" file pattern "*.ts".`),
			)
			setTestId(testId)
			await waitFor(() => state.taskCompleted, { timeout: 60_000 })
			assert.ok(state.toolExecuted, "search_files should have been executed with *.ts")
		} finally {
			api.off(JabberwockEventName.Message, mh)
			api.off(JabberwockEventName.TaskCompleted, ch)
		}
	})

	test("Should search for configuration keys in JSON files", async function () {
		const api = globalThis.api
		const { state, mh, ch, setTestId } = createSearchHandler((t) => t.includes("*.json"))
		api.on(JabberwockEventName.Message, mh)
		api.on(JabberwockEventName.TaskCompleted, ch)

		let testId: string
		try {
			testId = await api.startNewTask(
				getReadOnlyTaskConfig(`Search regex '"\\\\w+":\\\\s*' file pattern "*.json".`),
			)
			setTestId(testId)
			await waitFor(() => state.taskCompleted, { timeout: 60_000 })
			assert.ok(state.toolExecuted, "search_files should have been executed with JSON filter")
		} finally {
			api.off(JabberwockEventName.Message, mh)
			api.off(JabberwockEventName.TaskCompleted, ch)
		}
	})

	test("Should handle search with no matches", async function () {
		const api = globalThis.api
		const { state, mh, ch, setTestId } = createSearchHandler()
		api.on(JabberwockEventName.Message, mh)
		api.on(JabberwockEventName.TaskCompleted, ch)

		let testId: string
		try {
			testId = await api.startNewTask(
				getReadOnlyTaskConfig(`Search regex "nonExistentPattern12345" to test no matches.`),
			)
			setTestId(testId)
			await waitFor(() => state.taskCompleted, { timeout: 60_000 })
			assert.ok(state.toolExecuted, "search_files should have been executed")
		} finally {
			api.off(JabberwockEventName.Message, mh)
			api.off(JabberwockEventName.TaskCompleted, ch)
		}
	})

	test("Should search with complex regex (import/export) in JS/TS files", async function () {
		const api = globalThis.api
		const { state, mh, ch, setTestId } = createSearchHandler()
		api.on(JabberwockEventName.Message, mh)
		api.on(JabberwockEventName.TaskCompleted, ch)

		let testId: string
		try {
			testId = await api.startNewTask(
				getReadOnlyTaskConfig(
					`Search regex "(import|export).*" file pattern "*.{js,ts}" for import/export statements.`,
				),
			)
			setTestId(testId)
			await waitFor(() => state.taskCompleted, { timeout: 60_000 })
			assert.ok(state.toolExecuted, "search_files should have been executed with complex regex")
		} finally {
			api.off(JabberwockEventName.Message, mh)
			api.off(JabberwockEventName.TaskCompleted, ch)
		}
	})
})
