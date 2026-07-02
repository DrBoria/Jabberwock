/**
 * ShareVisibility
 */

export type ShareVisibility = "organization" | "public"

/**
 * ConnectionState
 */

export enum ConnectionState {
	DISCONNECTED = "disconnected",
	CONNECTING = "connecting",
	CONNECTED = "connected",
	RETRYING = "retrying",
	FAILED = "failed",
}

/**
 * RetryConfig
 */

export interface RetryConfig {
	maxInitialAttempts: number
	initialDelay: number
	maxDelay: number
	backoffMultiplier: number
}

/**
 * `emit()` Response Types
 */

export type JoinResponse = {
	success: boolean
	error?: string
	taskId?: string
	timestamp?: string
}

export type LeaveResponse = {
	success: boolean
	taskId?: string
	timestamp?: string
}
