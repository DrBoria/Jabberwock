interface WebviewProvider {
	postMessageToWebview(message: Record<string, unknown>): Promise<boolean | void> | void
}

/**
 * Extension-side intent context.
 */
interface IntentContext {
	provider?: WebviewProvider
	rootStore: RootStore
}

/**
 * Extension-side MST root store reference.
 */
interface RootStore {
	[key: string]: unknown
}

export type { WebviewProvider, IntentContext, RootStore }
