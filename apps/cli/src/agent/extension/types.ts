import type { ReasoningEffortExtended, JabberwockSettings, WebviewMessage } from "@jabberwock/types"
import { IExtensionHost, ExtensionHostEventMap } from "@jabberwock/vscode-shim"
import type { SupportedProvider } from "@/types/index.js"
import type { User } from "@/lib/sdk/index.js"
import type { AgentStateInfo } from "../state/types.js"
import type { ExtensionClient } from "./client.js"

export interface ExtensionHostOptions {
	mode: string
	reasoningEffort?: ReasoningEffortExtended | "unspecified" | "disabled"
	consecutiveMistakeLimit?: number
	user: User | null
	provider: SupportedProvider
	apiKey?: string
	model: string
	workspacePath: string
	extensionPath: string
	nonInteractive?: boolean
	ephemeral: boolean
	debug: boolean
	exitOnComplete: boolean
	terminalShell?: string
	exitOnError?: boolean
	disableOutput?: boolean
	integrationTest?: boolean
}

export interface ExtensionModule {
	activate: (context: unknown) => Promise<unknown>
	deactivate?: () => Promise<void>
}

export interface WebviewViewProvider {
	resolveWebviewView?(webviewView: unknown, context: unknown, token: unknown): void | Promise<void>
}

export interface ExtensionHostInterface extends IExtensionHost<ExtensionHostEventMap> {
	/**
	 * Loose listener registration. The original `ExtensionHost` class extended
	 * Node's `EventEmitter`, whose `on` accepted any `(...args) => void`
	 * listener; callers rely on passing listeners typed to the concrete
	 * message shape, so we keep that loose surface here.
	 */
	on(event: string, listener: (...args: never[]) => void): this
	/**
	 * Remove a previously registered listener (mirrors `EventEmitter#off`).
	 */
	off(event: string, listener: (...args: never[]) => void): this
	/**
	 * Whether the agent is currently waiting for user input (an ask is pending).
	 */
	isWaitingForInput(): boolean
	/**
	 * Snapshot of the current agent state (current ask, phase, etc.).
	 */
	getAgentState(): AgentStateInfo
	client: ExtensionClient
	activate(): Promise<void>
	runTask(prompt: string, taskId?: string, configuration?: JabberwockSettings, images?: string[]): Promise<void>
	resumeTask(taskId: string): Promise<void>
	sendToExtension(message: WebviewMessage): void
	dispose(): Promise<void>
}
