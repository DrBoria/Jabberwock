import type { ExtensionHostInterface, ExtensionHostOptions } from "@/agent/index.js"

export interface TUIAppProps extends ExtensionHostOptions {
	initialPrompt?: string
	initialTaskId?: string
	initialSessionId?: string
	continueSession?: boolean
	version: string
	createExtensionHost: (options: ExtensionHostOptions) => ExtensionHostInterface
}
