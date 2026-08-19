import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"
import { EventEmitter } from "events"

import pWaitFor from "p-wait-for"

import type { ExtensionMessage, WebviewMessage, JabberwockSettings } from "@jabberwock/types"
import { createVSCodeAPI, setRuntimeConfigValues } from "@jabberwock/vscode-shim"
import { setDebugLogEnabled } from "@jabberwock/core/cli"

import { createEphemeralStorageDir } from "@/lib/storage/index.js"

import type { AgentStateInfo } from "../state/index.js"
import { ExtensionClient } from "./client.js"
import { OutputManager } from "../output/manager.js"
import { PromptManager } from "../prompt-manager/prompt-manager.js"
import { AskDispatcher } from "../ask/dispatcher.js"
import {
	ExtensionConsoleManager,
	buildInitialSettings,
	setupClientEventHandlers,
	waitForTaskCompletion,
} from "./host-utils.js"
import {
	setupVSCodeModuleMock,
	loadExtensionModule,
	cleanupEphemeralStorage,
	resetCliRuntimeEnv,
	findCliPackageRoot,
} from "./host-env.js"
import type {
	ExtensionHostOptions,
	ExtensionHostInterface,
	ExtensionModule,
	WebviewViewProvider,
} from "./host-types.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLI_PACKAGE_JABBERWOCKT = process.env.JABBERWOCK_CLI_JABBERWOCKT || findCliPackageRoot(__dirname)

export class ExtensionHost extends EventEmitter implements ExtensionHostInterface {
	private vscode: ReturnType<typeof createVSCodeAPI> | null = null
	private extensionModule: ExtensionModule | null = null
	private extensionAPI: unknown = null
	private options: ExtensionHostOptions
	private isReady = false
	private messageListener: ((message: ExtensionMessage) => void) | null = null
	private initialSettings: ReturnType<typeof buildInitialSettings>
	private consoleManager = new ExtensionConsoleManager()
	private ephemeralStorageDir: string | null = null
	private previousCliRuntimeEnv: string | undefined

	public readonly client: ExtensionClient
	private outputManager: OutputManager
	private promptManager: PromptManager
	private askDispatcher: AskDispatcher

	constructor(options: ExtensionHostOptions) {
		super()
		this.options = options
		this.previousCliRuntimeEnv = process.env.JABBERWOCK_CLI_RUNTIME
		process.env.JABBERWOCK_CLI_RUNTIME = "1"
		if (options.debug) setDebugLogEnabled(true)
		this.consoleManager.setupQuietMode(options.integrationTest)
		this.client = new ExtensionClient({ sendMessage: (msg) => this.sendToExtension(msg), debug: options.debug })
		this.outputManager = new OutputManager({ disabled: options.disableOutput })
		this.promptManager = new PromptManager({
			onBeforePrompt: () => this.consoleManager.restoreConsole(),
			onAfterPrompt: () => this.consoleManager.setupQuietMode(),
		})
		this.askDispatcher = new AskDispatcher({
			outputManager: this.outputManager,
			promptManager: this.promptManager,
			sendMessage: (msg) => this.sendToExtension(msg),
			nonInteractive: options.nonInteractive,
			exitOnError: options.exitOnError,
			disabled: options.disableOutput,
		})
		this.initialSettings = buildInitialSettings(options)
		setupClientEventHandlers(this.client, this.outputManager, this.askDispatcher)
	}

	public async activate(): Promise<void> {
		const bundlePath = path.join(this.options.extensionPath, "extension.js")
		if (!fs.existsSync(bundlePath)) {
			this.consoleManager.restoreConsole()
			throw new Error(`Extension bundle not found at: ${bundlePath}`)
		}
		let storageDir: string | undefined
		if (this.options.ephemeral) {
			this.ephemeralStorageDir = await createEphemeralStorageDir()
			storageDir = this.ephemeralStorageDir
		}
		const {
			vscode,
			require: requireObj,
			restore,
		} = setupVSCodeModuleMock(
			this.options.extensionPath,
			this.options.workspacePath,
			CLI_PACKAGE_JABBERWOCKT,
			storageDir,
		)
		;(global as Record<string, unknown>).__extensionHost = this
		this.vscode = vscode
		try {
			this.extensionModule = (await loadExtensionModule(bundlePath, requireObj)) as ExtensionModule
		} catch (error) {
			restore()
			throw new Error(
				`Failed to load extension bundle: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
		restore()
		try {
			this.extensionAPI = await this.extensionModule.activate(vscode.context)
		} catch (error) {
			throw new Error(`Failed to activate extension: ${error instanceof Error ? error.message : String(error)}`)
		}
		this.messageListener = (message: ExtensionMessage) => this.client.handleMessage(message)
		this.on("extensionWebviewMessage", this.messageListener)
		await pWaitFor(() => this.isReady, { interval: 100, timeout: 10_000 })
	}

	public registerWebviewProvider(_viewId: string, _provider: WebviewViewProvider): void {}
	public unregisterWebviewProvider(_viewId: string): void {}

	public markWebviewReady(): void {
		this.isReady = true
		setRuntimeConfigValues("jabberwock", this.initialSettings as Record<string, unknown>)
		this.sendToExtension({ type: "updateSettings", updatedSettings: this.initialSettings })
		this.sendToExtension({ type: "webviewDidLaunch" })
	}

	public isInInitialSetup(): boolean {
		return !this.isReady
	}

	public sendToExtension(message: WebviewMessage): void {
		if (!this.isReady) throw new Error("You cannot send messages to the extension before it is ready")
		this.emit("webviewMessage", message)
	}

	public async runTask(
		prompt: string,
		taskId?: string,
		configuration?: JabberwockSettings,
		images?: string[],
	): Promise<void> {
		this.sendToExtension({
			type: "newTask",
			text: prompt,
			taskId,
			taskConfiguration: configuration,
			...(images !== undefined ? { images } : {}),
		})
		return waitForTaskCompletion(this.client, this.options)
	}

	public async resumeTask(taskId: string): Promise<void> {
		this.sendToExtension({ type: "showTaskWithId", text: taskId })
		return waitForTaskCompletion(this.client, this.options)
	}

	public getAgentState(): AgentStateInfo {
		return this.client.getAgentState()
	}

	public isWaitingForInput(): boolean {
		return this.client.getAgentState().isWaitingForInput
	}

	async dispose(): Promise<void> {
		this.outputManager.clear()
		this.askDispatcher.clear()
		if (this.messageListener) {
			this.off("extensionWebviewMessage", this.messageListener)
			this.messageListener = null
		}
		this.client.reset()
		if (this.extensionModule?.deactivate) {
			try {
				await this.extensionModule.deactivate()
			} catch {
				/* noop */
			}
		}
		this.vscode = null
		this.extensionModule = null
		this.extensionAPI = null
		delete (global as Record<string, unknown>).vscode
		delete (global as Record<string, unknown>).__extensionHost
		this.consoleManager.restoreConsole()
		await cleanupEphemeralStorage(this.ephemeralStorageDir)
		resetCliRuntimeEnv(this.previousCliRuntimeEnv)
	}
}
