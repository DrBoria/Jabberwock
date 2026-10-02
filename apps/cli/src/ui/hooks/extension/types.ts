import type { ExtensionMessage, WebviewMessage } from "@jabberwock/types"
import type { ExtensionHostInterface, ExtensionHostOptions } from "@/agent/index.js"

export interface UseExtensionHostOptions extends ExtensionHostOptions {
	initialPrompt?: string
	initialTaskId?: string
	initialSessionId?: string
	continueSession?: boolean
	onExtensionMessage: (msg: ExtensionMessage) => void
	createExtensionHost: (options: ExtensionHostOptions) => ExtensionHostInterface
}

export interface UseExtensionHostReturn {
	isReady: boolean
	sendToExtension: ((msg: WebviewMessage) => void) | null
	runTask: ((prompt: string) => Promise<void>) | null
	cleanup: () => Promise<void>
}
