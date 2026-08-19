import EventEmitter from "events"

import type { ExtensionContext } from "vscode"

import type {
	CloudUserInfo,
	CloudOrganizationMembership,
	AuthService,
	AuthServiceEvents,
	AuthState,
} from "@jabberwock/types"

import { getClerkBaseUrl, PRODUCTION_CLERK_BASE_URL } from "../config.ts"
import type { AuthCredentials } from "./web-auth-schemas.ts"
import { initiateLogin, handleAuthCallback, performLogout, storeCredentials } from "./web-auth-helpers.ts"
import { AuthSessionManager } from "./session-manager.ts"
import { clerkGetOrganizationMemberships as clerkGetOrganizationMembershipsHelper } from "./clerk-api-enrichment.ts"

export class WebAuthService extends EventEmitter<AuthServiceEvents> implements AuthService {
	private context: ExtensionContext
	private log: (...args: unknown[]) => void
	private readonly authCredentialsKey: string
	private sessionManager: AuthSessionManager

	constructor(context: ExtensionContext, log?: (...args: unknown[]) => void) {
		super()

		this.context = context
		this.log = log || console.log

		this.log("[auth] Using WebAuthService")

		const clerkBaseUrl = getClerkBaseUrl()

		if (clerkBaseUrl !== PRODUCTION_CLERK_BASE_URL) {
			this.authCredentialsKey = `clerk-auth-credentials-${clerkBaseUrl}`
		} else {
			this.authCredentialsKey = "clerk-auth-credentials"
		}

		this.sessionManager = new AuthSessionManager({
			context,
			authCredentialsKey: this.authCredentialsKey,
			log: this.log,
			onAuthStateChanged: (newState, previousState) => {
				this.emit("auth-state-changed", { state: newState, previousState })
			},
			onUserInfo: (userInfo) => {
				this.emit("user-info", { userInfo })
			},
		})
	}

	public async initialize(): Promise<void> {
		if (this.sessionManager.getState() !== "initializing") {
			this.log("[auth] initialize() called after already initialized")
			return
		}

		await this.sessionManager.initialize()

		this.context.subscriptions.push(
			this.context.secrets.onDidChange((e) => {
				if (e.key === this.authCredentialsKey) {
					this.sessionManager.handleCredentialsChange()
				}
			}),
		)
	}

	public broadcast(): void {}

	public async login(landingPageSlug?: string, useProviderSignup: boolean = false): Promise<void> {
		await initiateLogin(this.context, this.log, landingPageSlug, useProviderSignup)
	}

	public async handleCallback(
		code: string | null,
		state: string | null,
		organizationId?: string | null,
		providerModel?: string | null,
	): Promise<void> {
		await handleAuthCallback(
			this.context,
			code,
			state,
			this.log,
			() => this.sessionManager.getClerkApiDeps(),
			this.authCredentialsKey,
			organizationId,
			providerModel,
		)
	}

	public async logout(): Promise<void> {
		await performLogout(
			this.context,
			this.authCredentialsKey,
			this.sessionManager.getCredentials(),
			() => this.sessionManager.getClerkApiDeps(),
			this.log,
		)
	}

	public getState(): AuthState {
		return this.sessionManager.getState()
	}

	public getSessionToken(): string | undefined {
		return this.sessionManager.getSessionToken()
	}

	public isAuthenticated(): boolean {
		const state = this.sessionManager.getState()
		return state === "active-session" || state === "attempting-session" || state === "inactive-session"
	}

	public hasActiveSession(): boolean {
		return this.sessionManager.getState() === "active-session"
	}

	public hasOrIsAcquiringActiveSession(): boolean {
		const state = this.sessionManager.getState()
		return state === "active-session" || state === "attempting-session"
	}

	public getUserInfo(): CloudUserInfo | null {
		return this.sessionManager.getUserInfo()
	}

	public getStoredOrganizationId(): string | null {
		return this.sessionManager.getStoredOrganizationId()
	}

	public async switchOrganization(organizationId: string | null): Promise<void> {
		if (!this.sessionManager.getCredentials()) {
			throw new Error("Cannot switch organization: not authenticated")
		}

		const updatedCredentials: AuthCredentials = {
			...this.sessionManager.getCredentials()!,
			organizationId: organizationId,
		}

		await storeCredentials(this.context, this.authCredentialsKey, updatedCredentials)
	}

	public async getOrganizationMemberships(): Promise<CloudOrganizationMembership[]> {
		if (!this.sessionManager.getCredentials()) {
			return []
		}

		try {
			return await clerkGetOrganizationMembershipsHelper(this.sessionManager.getClerkApiDeps())
		} catch (error) {
			this.log(`[auth] Failed to get organization memberships: ${error}`)
			return []
		}
	}
}
