// Type declarations for path aliases resolved at build time by webview-ui's vite config.
declare module "@src/context/ExtensionStateContext" {
	import type { ClineMessage } from "@jabberwock/types"

	export interface ExtensionState {
		version: string
		clineMessages: ClineMessage[]
		ts: number
		[key: string]: unknown
	}

	export function useExtensionState(): {
		version: string
		clineMessages: ClineMessage[]
		[k: string]: unknown
	}
}
