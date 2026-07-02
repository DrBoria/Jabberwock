import EventEmitter from "events"

import type {
	TelemetryEvent,
	CloudServiceEvents,
	AuthService,
	SettingsService,
	CloudUserInfo,
	CloudOrganizationMembership,
	OrganizationAllowList,
	OrganizationSettings,
	UserSettingsConfig,
	UserSettingsData,
	UserFeatures,
} from "@jabberwock/types"

import type { CloudAPI } from "./CloudAPI.ts"
import type { CloudShareService } from "./CloudShareService.ts"
import type { CloudTelemetryClient as TelemetryClient } from "../telemetry/CloudTelemetryClient.ts"
import type { RetryQueue } from "../retry-queue/index.ts"

export abstract class CloudServiceFacade extends EventEmitter<CloudServiceEvents> {
	protected _authService: AuthService | null = null
	protected _settingsService: SettingsService | null = null
	protected _telemetryClient: TelemetryClient | null = null
	protected _shareService: CloudShareService | null = null
	protected _cloudAPI: CloudAPI | null = null
	protected _retryQueue: RetryQueue | null = null
	protected _isCloudAgent = false
	public isInitialized = false
	protected log: (...args: unknown[]) => void = () => {}

	public get authService() {
		return this._authService
	}

	public get settingsService() {
		return this._settingsService
	}

	public get telemetryClient() {
		return this._telemetryClient
	}

	public get shareService() {
		return this._shareService
	}

	public get cloudAPI() {
		return this._cloudAPI
	}

	public get retryQueue() {
		return this._retryQueue
	}

	public get isCloudAgent() {
		return this._isCloudAgent
	}

	protected ensureInitialized(): void {
		if (!this.isInitialized) {
			throw new Error("CloudService not initialized.")
		}
	}

	// ============= AuthService convenience methods =============

	public async login(landingPageSlug?: string, useProviderSignup?: boolean): Promise<void> {
		this.ensureInitialized()
		return this.authService!.login(landingPageSlug, useProviderSignup)
	}

	public async logout(): Promise<void> {
		this.ensureInitialized()
		return this.authService!.logout()
	}

	public async handleAuthCallback(
		code: string,
		state: string,
		organizationId?: string,
		providerModel?: string,
	): Promise<void> {
		this.ensureInitialized()
		return this.authService!.handleCallback(code, state, organizationId, providerModel)
	}

	public async switchOrganization(organizationId: string | null): Promise<void> {
		this.ensureInitialized()
		await this.authService!.switchOrganization(organizationId)
	}

	public async getOrganizationMemberships(): Promise<CloudOrganizationMembership[]> {
		this.ensureInitialized()
		return await this.authService!.getOrganizationMemberships()
	}

	public isAuthenticated(): boolean {
		return this.authService?.isAuthenticated() ?? false
	}

	public hasOrIsAcquiringActiveSession(): boolean {
		return this.authService?.hasOrIsAcquiringActiveSession() ?? false
	}

	public getOrganizationId(): string | undefined {
		return this.authService?.getUserInfo()?.organizationId ?? undefined
	}

	public hasActiveSession(): boolean {
		return this.authService?.hasActiveSession?.() ?? false
	}

	public getOrganizationName(): string | undefined {
		return this.authService?.getUserInfo()?.organizationName
	}

	public getOrganizationRole(): string | undefined {
		return this.authService?.getUserInfo()?.organizationRole
	}

	public hasStoredOrganizationId(): boolean {
		return !!this.authService?.getStoredOrganizationId()
	}

	public getStoredOrganizationId(): string | undefined {
		return this.authService?.getStoredOrganizationId() ?? undefined
	}

	public getUserInfo(): CloudUserInfo | undefined {
		return this.authService?.getUserInfo() ?? undefined
	}

	public getAuthState(): string | undefined {
		return this.authService?.getState()
	}

	// ============= SettingsService convenience methods =============

	public getAllowList(): OrganizationAllowList {
		this.ensureInitialized()
		return this.settingsService!.getAllowList()
	}

	public getOrganizationSettings(): OrganizationSettings | undefined {
		this.ensureInitialized()
		return this.settingsService!.getSettings()
	}

	public getUserSettings(): UserSettingsData | undefined {
		this.ensureInitialized()
		return this.settingsService!.getUserSettings()
	}

	public getUserFeatures(): UserFeatures {
		this.ensureInitialized()
		return this.settingsService!.getUserFeatures()
	}

	public getUserSettingsConfig(): UserSettingsConfig {
		this.ensureInitialized()
		return this.settingsService!.getUserSettingsConfig()
	}

	public async updateUserSettings(settings: Partial<UserSettingsConfig>): Promise<boolean> {
		this.ensureInitialized()
		return this.settingsService!.updateUserSettings(settings)
	}

	public isTaskSyncEnabled(): boolean {
		this.ensureInitialized()
		return this.settingsService!.isTaskSyncEnabled()
	}

	// ============= TelemetryClient convenience methods =============

	public captureEvent(event: TelemetryEvent): void {
		this.ensureInitialized()
		this.telemetryClient!.capture(event)
	}

	// ============= ShareService convenience methods =============

	public async canShareTask(): Promise<boolean> {
		this.ensureInitialized()
		return this.shareService!.canShareTask()
	}

	public async canSharePublicly(): Promise<boolean> {
		this.ensureInitialized()
		return this.shareService!.canSharePublicly()
	}
}
