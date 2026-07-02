import type { ExtensionState } from "@jabberwock/types"

export interface FrontendActionLogEntry {
	name: string
	path: string
	args: unknown[]
	timestamp: number
}

export interface WindowWithDevtool extends Window {
	__JABBERWOCK_GET_STATE__?: () => Record<string, unknown>
}

export interface RootStoreSelf {
	extensionState: ExtensionState
	showWelcome: boolean
	_welcomeDismissed: boolean
	interactiveAppUri: string
	currentCheckpoint: string
	settings: {
		setHasOpenedModeSelector(v: boolean): void
		setAlwaysAllowFollowupQuestions(v: boolean): void
		setFollowupAutoApproveTimeoutMs(v: number): void
		setProfileThresholds(v: Record<string, number>): void
		setIncludeTaskHistoryInEnhance(v: boolean): void
		setIncludeCurrentTime(v: boolean): void
		setIncludeCurrentCost(v: boolean): void
	}
	cloud: {
		cloudIsAuthenticated: boolean | undefined
		prevCloudIsAuthenticated: boolean
		setPrevCloudIsAuthenticated(v: boolean): void
	}
}
