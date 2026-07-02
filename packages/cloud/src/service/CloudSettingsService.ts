import EventEmitter from "events"

import type { ExtensionContext } from "vscode"

import {
	type SettingsService,
	type SettingsServiceEvents,
	type AuthService,
	type AuthState,
	type UserFeatures,
	type UserSettingsConfig,
	type UserSettingsData,
	OrganizationAllowList,
	OrganizationSettings,
	userSettingsDataSchema,
	ORGANIZATION_ALLOW_ALL,
} from "@jabberwock/types"
import { getJabberwockApiUrl } from "../config.ts"
import { RefreshTimer } from "../RefreshTimer.ts"
import { parseExtensionSettingsResponse } from "../settings/parseExtensionSettings.ts"
import { cacheSettings, loadCachedSettings, removeSettings } from "../settings/cloud-settings-persistence.ts"
import { doFetchSettings, detectOrgSettingsChange, detectUserSettingsChange } from "../settings/cloud-settings-fetch.ts"

export class CloudSettingsService extends EventEmitter<SettingsServiceEvents> implements SettingsService {
	private context: ExtensionContext
	private authService: AuthService
	private settings: OrganizationSettings | undefined = undefined
	private userSettings: UserSettingsData | undefined = undefined
	private timer: RefreshTimer
	private log: (...args: unknown[]) => void

	constructor(context: ExtensionContext, authService: AuthService, log?: (...args: unknown[]) => void) {
		super()

		this.context = context
		this.authService = authService
		this.log = log || console.log

		this.timer = new RefreshTimer({
			callback: async () => {
				return await this.fetchSettings()
			},
			successInterval: 3_600_000,
			initialBackoffMs: 1000,
			maxBackoffMs: 3_600_000,
		})
	}

	public async initialize(): Promise<void> {
		const cached = loadCachedSettings(this.context)
		this.settings = cached.settings
		this.userSettings = cached.userSettings

		if (this.authService.getState() == "logged-out" && (this.settings || this.userSettings)) {
			this.settings = undefined
			this.userSettings = undefined
			await removeSettings(this.context)
		}

		this.authService.on("auth-state-changed", async (data: { state: AuthState; previousState: AuthState }) => {
			try {
				if (data.state === "active-session") {
					this.timer.start()
				} else if (data.previousState === "active-session") {
					this.timer.stop()

					if (data.state === "logged-out") {
						this.settings = undefined
						this.userSettings = undefined
						await removeSettings(this.context)
					}
				}
			} catch (error) {
				this.log(`[cloud-settings] error processing auth-state-changed: ${error}`, error)
			}
		})

		if (this.authService.hasActiveSession()) {
			this.timer.start()
		}
	}

	private async fetchSettings(): Promise<boolean> {
		const token = this.authService.getSessionToken()

		if (!token) {
			return false
		}

		try {
			const response = await doFetchSettings(token, this.log)

			if (!response) {
				return false
			}

			return await this.processFetchSettingsResponse(response)
		} catch (error) {
			this.log("[cloud-settings] Error fetching extension settings:", error)
			return false
		}
	}

	private async processFetchSettingsResponse(response: Response): Promise<boolean> {
		const data = await response.json()
		const result = parseExtensionSettingsResponse(data)

		if (!result.success) {
			this.log("[cloud-settings] Invalid extension settings format:", result.error)
			return false
		}

		const { organization: newOrgSettings, user: newUserSettings } = result.data

		const orgChanged = detectOrgSettingsChange(this.settings, newOrgSettings, (value) => {
			this.settings = value
		})
		const userChanged = detectUserSettingsChange(this.userSettings, newUserSettings, (value) => {
			this.userSettings = value
		})

		if (orgChanged || userChanged) {
			this.emit("settings-updated", {} as Record<string, never>)
		}

		if (orgChanged || userChanged) {
			await cacheSettings(this.context, this.settings, this.userSettings)
		}

		return true
	}

	public getAllowList(): OrganizationAllowList {
		return this.settings?.allowList || ORGANIZATION_ALLOW_ALL
	}

	public getSettings(): OrganizationSettings | undefined {
		return this.settings
	}

	public getUserSettings(): UserSettingsData | undefined {
		return this.userSettings
	}

	public getUserFeatures(): UserFeatures {
		return this.userSettings?.features || {}
	}

	public getUserSettingsConfig(): UserSettingsConfig {
		return this.userSettings?.settings || {}
	}

	public async updateUserSettings(settings: Partial<UserSettingsConfig>): Promise<boolean> {
		const token = this.authService.getSessionToken()

		if (!token) {
			this.log("[cloud-settings] No session token available for updating user settings")
			return false
		}

		try {
			const currentVersion = this.userSettings?.version
			const requestBody: {
				settings: Partial<UserSettingsConfig>
				version?: number
			} = {
				settings,
			}

			if (currentVersion !== undefined) {
				requestBody.version = currentVersion
			}

			const response = await fetch(`${getJabberwockApiUrl()}/api/user-settings`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify(requestBody),
			})

			if (!response.ok) {
				if (response.status === 409) {
					this.log(
						"[cloud-settings] Version conflict when updating user settings - settings may have been updated elsewhere",
					)
				} else {
					this.log("[cloud-settings] Failed to update user settings:", response.status, response.statusText)
				}
				return false
			}

			const updatedUserSettings = await response.json()
			const result = userSettingsDataSchema.safeParse(updatedUserSettings)

			if (!result.success) {
				this.log("[cloud-settings] Invalid user settings response format:", result.error)
				return false
			}

			if (!this.userSettings || result.data.version > this.userSettings.version) {
				this.userSettings = result.data
				await cacheSettings(this.context, this.settings, this.userSettings)
				this.emit("settings-updated", {} as Record<string, never>)
			}

			return true
		} catch (error) {
			this.log("[cloud-settings] Error updating user settings:", error)
			return false
		}
	}

	public isTaskSyncEnabled(): boolean {
		if (this.authService.getStoredOrganizationId()) {
			return this.settings?.cloudSettings?.recordTaskMessages ?? false
		}

		const userSettings = this.userSettings
		if (userSettings) {
			return userSettings.settings.taskSyncEnabled ?? true
		}

		return false
	}

	public dispose(): void {
		this.removeAllListeners()
		this.timer.stop()
	}
}
