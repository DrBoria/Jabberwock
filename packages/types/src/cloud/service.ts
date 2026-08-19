import EventEmitter from "events"

import {
	CloudOrganizationMembership,
	CloudUserInfo,
	OrganizationAllowList,
	OrganizationSettings,
	UserFeatures,
	UserSettingsConfig,
	UserSettingsData,
} from "./organization.ts"

/**
 * AuthState
 */

export type AuthState = "initializing" | "logged-out" | "active-session" | "attempting-session" | "inactive-session"

/**
 * AuthService
 */

export interface AuthService extends EventEmitter<AuthServiceEvents> {
	// Lifecycle
	initialize(): Promise<void>
	broadcast(): void

	// Authentication methods
	login(landingPageSlug?: string, useProviderSignup?: boolean): Promise<void>
	logout(): Promise<void>
	handleCallback(
		code: string | null,
		state: string | null,
		organizationId?: string | null,
		providerModel?: string | null,
	): Promise<void>
	switchOrganization(organizationId: string | null): Promise<void>

	// State methods
	getState(): AuthState
	isAuthenticated(): boolean
	hasActiveSession(): boolean
	hasOrIsAcquiringActiveSession(): boolean

	// Token and user info
	getSessionToken(): string | undefined
	getUserInfo(): CloudUserInfo | null
	getStoredOrganizationId(): string | null

	// Organization management
	getOrganizationMemberships(): Promise<CloudOrganizationMembership[]>
}

/**
 * AuthServiceEvents
 */

export interface AuthServiceEvents {
	"auth-state-changed": [
		data: {
			state: AuthState
			previousState: AuthState
		},
	]
	"user-info": [data: { userInfo: CloudUserInfo }]
}

/**
 * SettingsService
 */

/**
 * Interface for settings services that provide organization settings
 */
export interface SettingsService {
	/**
	 * Get the organization allow list
	 * @returns The organization allow list or default if none available
	 */
	getAllowList(): OrganizationAllowList

	/**
	 * Get the current organization settings
	 * @returns The organization settings or undefined if none available
	 */
	getSettings(): OrganizationSettings | undefined

	/**
	 * Get the current user settings
	 * @returns The user settings data or undefined if none available
	 */
	getUserSettings(): UserSettingsData | undefined

	/**
	 * Get the current user features
	 * @returns The user features or empty object if none available
	 */
	getUserFeatures(): UserFeatures

	/**
	 * Get the current user settings configuration
	 * @returns The user settings configuration or empty object if none available
	 */
	getUserSettingsConfig(): UserSettingsConfig

	/**
	 * Update user settings with partial configuration
	 * @param settings Partial user settings configuration to update
	 * @returns Promise that resolves to true if successful, false otherwise
	 */
	updateUserSettings(settings: Partial<UserSettingsConfig>): Promise<boolean>

	/**
	 * Determines if task sync/recording is enabled based on organization and user settings
	 * Organization settings take precedence over user settings.
	 * User settings default to true if unspecified.
	 * @returns true if task sync is enabled, false otherwise
	 */
	isTaskSyncEnabled(): boolean

	/**
	 * Dispose of the settings service and clean up resources
	 */
	dispose(): void
}

/**
 * SettingsServiceEvents
 */

export interface SettingsServiceEvents {
	"settings-updated": [data: Record<string, never>]
}

/**
 * CloudServiceEvents
 */

export type CloudServiceEvents = AuthServiceEvents & SettingsServiceEvents
