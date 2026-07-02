import type { Disposable, ExtensionContext } from "vscode"

import type { CloudServiceEvents, Notification, ShareVisibility } from "@jabberwock/types"

import { TaskNotFoundError } from "../errors.ts"
import { WebAuthService } from "../auth/WebAuthService.ts"
import { StaticTokenAuthService } from "../auth/StaticTokenAuthService.ts"
import { CloudSettingsService } from "./CloudSettingsService.ts"
import { StaticSettingsService } from "./StaticSettingsService.ts"
import { CloudTelemetryClient as TelemetryClient } from "../telemetry/CloudTelemetryClient.ts"
import { CloudShareService } from "./CloudShareService.ts"
import { CloudAPI } from "./CloudAPI.ts"
import { RetryQueue } from "../retry-queue/index.ts"
import { CloudServiceFacade } from "./CloudServiceFacade.ts"
import { createAuthHeaderProvider, handleAuthStateChangeForRetryQueue } from "../cloud-service-helpers.ts"

type AuthStateChangedPayload = CloudServiceEvents["auth-state-changed"][0]
type AuthUserInfoPayload = CloudServiceEvents["user-info"][0]
type SettingsPayload = CloudServiceEvents["settings-updated"][0]

export class CloudService extends CloudServiceFacade implements Disposable {
	private context: ExtensionContext

	private authStateListener: (data: AuthStateChangedPayload) => void
	private authUserInfoListener: (data: AuthUserInfoPayload) => void
	private settingsListener: (data: SettingsPayload) => void

	constructor(context: ExtensionContext, log?: (...args: unknown[]) => void) {
		super()
		this.context = context
		this.log = log || (() => {})

		this.authStateListener = (data: AuthStateChangedPayload) => {
			handleAuthStateChangeForRetryQueue(data, this._retryQueue, this.getUserInfo, this.log)
			this.emit("auth-state-changed", data)
		}

		this.authUserInfoListener = (data: AuthUserInfoPayload) => {
			this.emit("user-info", data)
		}

		this.settingsListener = (data: SettingsPayload) => {
			this.emit("settings-updated", data)
		}
	}

	public async initialize(): Promise<void> {
		if (this.isInitialized) {
			return
		}

		try {
			const cloudToken = process.env.JABBERWOCK_CODE_CLOUD_TOKEN

			if (cloudToken && cloudToken.length > 0) {
				this._authService = new StaticTokenAuthService(this.context, cloudToken, this.log)
				this._isCloudAgent = true
			} else {
				this._authService = new WebAuthService(this.context, this.log)
			}

			this._authService.on("auth-state-changed", this.authStateListener)
			this._authService.on("user-info", this.authUserInfoListener)
			await this._authService.initialize()

			const staticOrgSettings = process.env.JABBERWOCK_CODE_CLOUD_ORG_SETTINGS

			if (staticOrgSettings && staticOrgSettings.length > 0) {
				this._settingsService = new StaticSettingsService(staticOrgSettings, this.log)
			} else {
				const cloudSettingsService = new CloudSettingsService(this.context, this._authService, this.log)

				cloudSettingsService.on("settings-updated", this.settingsListener)
				await cloudSettingsService.initialize()

				this._settingsService = cloudSettingsService
			}

			this._cloudAPI = new CloudAPI(this._authService, this.log)

			this._retryQueue = new RetryQueue(
				this.context,
				undefined,
				this.log,
				createAuthHeaderProvider(() => this._authService),
			)

			this._telemetryClient = new TelemetryClient(this._authService, this._settingsService, this._retryQueue)

			this._shareService = new CloudShareService(this._cloudAPI, this._settingsService, this.log)

			this.isInitialized = true
		} catch (error) {
			this.log("[CloudService] Failed to initialize:", error)
			throw new Error(`Failed to initialize CloudService: ${error}`)
		}
	}

	public dispose(): void {
		if (this.authService) {
			this.authService.off("auth-state-changed", this.authStateListener)
			this.authService.off("user-info", this.authUserInfoListener)
		}

		if (this.settingsService) {
			if (this.settingsService instanceof CloudSettingsService) {
				this.settingsService.off("settings-updated", this.settingsListener)
			}

			this.settingsService.dispose()
		}

		if (this._retryQueue) {
			this._retryQueue.dispose()
		}

		this.isInitialized = false
	}

	public async shareTask(taskId: string, visibility: ShareVisibility = "organization", messages?: Notification[]) {
		this.ensureInitialized()

		try {
			return await this.shareService!.shareTask(taskId, visibility)
		} catch (error) {
			if (error instanceof TaskNotFoundError && messages) {
				await this.telemetryClient!.backfillMessages(messages, taskId)
				return await this.shareService!.shareTask(taskId, visibility)
			}

			throw error
		}
	}
}
