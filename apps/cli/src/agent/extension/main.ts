import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"

import pWaitFor from "p-wait-for"

import type { ExtensionMessage, WebviewMessage, JabberwockSettings } from "@jabberwock/types"
import { setRuntimeConfigValues } from "@jabberwock/vscode-shim"
import { setDebugLogEnabled } from "@jabberwock/core/cli"

import { createEphemeralStorageDir } from "@/lib/storage/index.js"

import type { AgentStateInfo } from "../state/index.js"
import { createExtensionClient, type ExtensionClient } from "./client.js"
import { createOutputManager, type OutputManager } from "../output/manager.js"
import { createPromptManager, type PromptManager } from "../prompt-manager/manager.js"
import { createAskDispatcher, type AskDispatcher } from "../ask/main.js"
import {
	createExtensionConsoleManager,
	type ExtensionConsoleManager,
	buildInitialSettings,
	setupClientEventHandlers,
	waitForTaskCompletion,
} from "./utils.js"
import {
	setupVSCodeModuleMock,
	loadExtensionModule,
	cleanupEphemeralStorage,
	resetCliRuntimeEnv,
	findCliPackageRoot,
} from "./env.js"
import type { ExtensionHostOptions, ExtensionHostInterface, ExtensionModule, WebviewViewProvider } from "./types.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLI_PACKAGE_JABBERWOCKT = process.env.JABBERWOCK_CLI_JABBERWOCKT || findCliPackageRoot(__dirname)

export function createExtensionHost(options: ExtensionHostOptions): ExtensionHostInterface {
	const extensionHostListeners = new Map<string, Set<(message: unknown) => void>>()
	let extensionModule: ExtensionModule | null = null
	let isReady = false
	let messageListener: ((message: ExtensionMessage) => void) | null = null
	let ephemeralStorageDir: string | null = null
	const previousCliRuntimeEnv = process.env.JABBERWOCK_CLI_RUNTIME
	const consoleManager: ExtensionConsoleManager = createExtensionConsoleManager()
	const initialSettings = buildInitialSettings(options)

	process.env.JABBERWOCK_CLI_RUNTIME = "1"
	if (options.debug) setDebugLogEnabled(true)
	consoleManager.setupQuietMode(options.integrationTest)

	const client: ExtensionClient = createExtensionClient({
		sendMessage: (msg) => sendToExtension(msg),
		debug: options.debug,
	})
	const outputManager: OutputManager = createOutputManager({ disabled: options.disableOutput })
	const promptManager: PromptManager = createPromptManager({
		onBeforePrompt: () => consoleManager.restoreConsole(),
		onAfterPrompt: () => consoleManager.setupQuietMode(),
	})
	const askDispatcher: AskDispatcher = createAskDispatcher({
		outputManager,
		promptManager,
		sendMessage: (msg) => sendToExtension(msg),
		nonInteractive: options.nonInteractive,
		exitOnError: options.exitOnError,
		disabled: options.disableOutput,
	})
	setupClientEventHandlers(client, outputManager, askDispatcher)

	async function activate(): Promise<void> {
		const bundlePath = path.join(options.extensionPath, "extension.js")
		if (!fs.existsSync(bundlePath)) {
			consoleManager.restoreConsole()
			throw new Error(`Extension bundle not found at: ${bundlePath}`)
		}
		let storageDir: string | undefined
		if (options.ephemeral) {
			ephemeralStorageDir = await createEphemeralStorageDir()
			storageDir = ephemeralStorageDir
		}
		const {
			vscode: vscodeApi,
			require: requireObj,
			restore,
		} = setupVSCodeModuleMock(options.extensionPath, options.workspacePath, CLI_PACKAGE_JABBERWOCKT, storageDir)
		;(global as Record<string, unknown>).__extensionHost = host
		try {
			extensionModule = (await loadExtensionModule(bundlePath, requireObj)) as ExtensionModule
		} catch (error) {
			restore()
			throw new Error(
				`Failed to load extension bundle: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
		restore()
		try {
			await extensionModule.activate(vscodeApi.context)
		} catch (error) {
			throw new Error(`Failed to activate extension: ${error instanceof Error ? error.message : String(error)}`)
		}
		messageListener = (message: ExtensionMessage) => client.handleMessage(message)
		hostOn("extensionWebviewMessage", messageListener as (message: unknown) => void)
		await pWaitFor(() => isReady, { interval: 100, timeout: 10_000 })
	}

	function registerWebviewProvider(_viewId: string, _provider: WebviewViewProvider): void {}
	function unregisterWebviewProvider(_viewId: string): void {}

	function markWebviewReady(): void {
		isReady = true
		setRuntimeConfigValues("jabberwock", initialSettings as Record<string, unknown>)
		sendToExtension({ type: "updateSettings", updatedSettings: initialSettings })
		sendToExtension({ type: "webviewDidLaunch" })
	}

	function isInInitialSetup(): boolean {
		return !isReady
	}

	function sendToExtension(message: WebviewMessage): void {
		if (!isReady) throw new Error("You cannot send messages to the extension before it is ready")
		hostEmit("webviewMessage", message)
	}

	async function runTask(
		prompt: string,
		taskId?: string,
		configuration?: JabberwockSettings,
		images?: string[],
	): Promise<void> {
		sendToExtension({
			type: "newTask",
			text: prompt,
			taskId,
			taskConfiguration: configuration,
			...(images !== undefined ? { images } : {}),
		})
		return waitForTaskCompletion(client, options)
	}

	async function resumeTask(taskId: string): Promise<void> {
		sendToExtension({ type: "showTaskWithId", text: taskId })
		return waitForTaskCompletion(client, options)
	}

	function getAgentState(): AgentStateInfo {
		return client.getAgentState()
	}

	function isWaitingForInput(): boolean {
		return client.getAgentState().isWaitingForInput
	}

	async function dispose(): Promise<void> {
		outputManager.clear()
		askDispatcher.clear()
		if (messageListener) {
			hostOff("extensionWebviewMessage", messageListener as (message: unknown) => void)
			messageListener = null
		}
		client.reset()
		if (extensionModule?.deactivate) {
			try {
				await extensionModule.deactivate()
			} catch (error) {
				console.error("[CLI] Extension deactivate failed:", error)
			}
		}
		extensionModule = null
		delete (global as Record<string, unknown>).vscode
		delete (global as Record<string, unknown>).__extensionHost
		consoleManager.restoreConsole()
		await cleanupEphemeralStorage(ephemeralStorageDir)
		resetCliRuntimeEnv(previousCliRuntimeEnv)
	}

	function hostEmit(event: string, message: unknown): boolean {
		const set = extensionHostListeners.get(event)
		if (!set) return false
		for (const listener of set) listener(message)
		return true
	}

	function hostOn(event: string, listener: (message: unknown) => void): ExtensionHostInterface {
		let set = extensionHostListeners.get(event)
		if (!set) {
			set = new Set()
			extensionHostListeners.set(event, set)
		}
		set.add(listener)
		return host
	}

	function hostOff(event: string, listener: (message: unknown) => void): ExtensionHostInterface {
		extensionHostListeners.get(event)?.delete(listener)
		return host
	}

	const host: ExtensionHostInterface = {
		client,
		activate,
		registerWebviewProvider,
		unregisterWebviewProvider,
		isInInitialSetup,
		markWebviewReady,
		emit: (event, message) => hostEmit(event, message),
		on: (event, listener) => hostOn(event, listener as (message: unknown) => void),
		off: (event, listener) => hostOff(event, listener as (message: unknown) => void),
		runTask,
		resumeTask,
		sendToExtension,
		getAgentState,
		isWaitingForInput,
		dispose,
	}

	return host
}

/** ExtensionHost instance type */
export type ExtensionHost = ExtensionHostInterface
