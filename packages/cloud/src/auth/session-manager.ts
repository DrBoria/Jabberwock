import type { ExtensionContext } from "vscode"

import type { AuthState, CloudUserInfo } from "@jabberwock/types"

import { clerkCreateSessionToken as clerkCreateSessionTokenHelper, clerkMe as clerkMeHelper } from "./clerk-api.ts"
import { InvalidClientTokenError } from "../errors.ts"
import { RefreshTimer } from "../RefreshTimer.ts"
import type { AuthCredentials } from "./web-auth-schemas.ts"
import { clearCredentials, loadCredentials } from "./web-auth-helpers.ts"

export interface AuthSessionManagerDeps {
	context: ExtensionContext
	authCredentialsKey: string
	log: (...args: unknown[]) => void
	onAuthStateChanged: (newState: AuthState, previousState: AuthState) => void
	onUserInfo: (userInfo: CloudUserInfo) => void
}

export class AuthSessionManager {
	private context: ExtensionContext
	private log: (...args: unknown[]) => void
	private authCredentialsKey: string
	private onAuthStateChanged: (newState: AuthState, previousState: AuthState) => void
	private onUserInfo: (userInfo: CloudUserInfo) => void

	private credentials: AuthCredentials | null = null
	private sessionToken: string | null = null
	private userInfo: CloudUserInfo | null = null
	private state: AuthState = "initializing"
	private isFirstRefreshAttempt: boolean = false
	private timer: RefreshTimer

	constructor(deps: AuthSessionManagerDeps) {
		this.context = deps.context
		this.log = deps.log
		this.authCredentialsKey = deps.authCredentialsKey
		this.onAuthStateChanged = deps.onAuthStateChanged
		this.onUserInfo = deps.onUserInfo

		this.timer = new RefreshTimer({
			callback: async () => {
				await this.refreshSession()
				return true
			},
			successInterval: 50_000,
			initialBackoffMs: 1_000,
			maxBackoffMs: 300_000,
		})
	}

	getState(): AuthState {
		return this.state
	}

	getCredentials(): AuthCredentials | null {
		return this.credentials
	}

	getUserInfo(): CloudUserInfo | null {
		return this.userInfo
	}

	getStoredOrganizationId(): string | null {
		return this.credentials?.organizationId || null
	}

	getSessionToken(): string | undefined {
		if (this.state === "active-session" && this.sessionToken) {
			return this.sessionToken
		}
		return undefined
	}

	async initialize(): Promise<void> {
		await this.handleCredentialsChange()
	}

	async handleCredentialsChange(): Promise<void> {
		try {
			const credentials = await loadCredentials(this.context, this.authCredentialsKey, this.userInfo, this.log)

			if (credentials) {
				if (
					this.credentials === null ||
					this.credentials.clientToken !== credentials.clientToken ||
					this.credentials.sessionId !== credentials.sessionId ||
					this.credentials.organizationId !== credentials.organizationId
				) {
					this.transitionToAttemptingSession(credentials)
				}
			} else {
				if (this.state !== "logged-out") {
					this.transitionToLoggedOut()
				}
			}
		} catch (error) {
			this.log("[auth] Error handling credentials change:", error)
		}
	}

	private changeState(newState: AuthState): void {
		const previousState = this.state
		this.state = newState
		this.log(`[auth] changeState: ${previousState} -> ${newState}`)
		this.onAuthStateChanged(newState, previousState)
	}

	private transitionToLoggedOut(): void {
		this.timer.stop()

		this.credentials = null
		this.sessionToken = null
		this.userInfo = null

		this.changeState("logged-out")
	}

	private transitionToAttemptingSession(credentials: AuthCredentials): void {
		this.credentials = credentials

		this.sessionToken = null
		this.userInfo = null
		this.isFirstRefreshAttempt = true

		this.changeState("attempting-session")

		this.timer.stop()
		this.timer.start()
	}

	private transitionToInactiveSession(): void {
		this.sessionToken = null
		this.userInfo = null

		this.changeState("inactive-session")
	}

	private async refreshSession(): Promise<void> {
		if (!this.credentials) {
			this.log("[auth] Cannot refresh session: missing credentials")
			return
		}

		try {
			const previousState = this.state
			this.sessionToken = await clerkCreateSessionTokenHelper(this.credentials!, this.getClerkApiDeps())

			if (previousState !== "active-session") {
				this.changeState("active-session")
				this.fetchUserInfo()
			} else {
				this.state = "active-session"
			}
		} catch (error) {
			if (error instanceof InvalidClientTokenError) {
				this.log("[auth] Invalid/Expired client token: clearing credentials")
				await this.clearCredentials()
			} else if (this.isFirstRefreshAttempt && this.state === "attempting-session") {
				this.isFirstRefreshAttempt = false
				this.transitionToInactiveSession()
			}
			this.log("[auth] Failed to refresh session", error)
			throw error
		}
	}

	private async clearCredentials(): Promise<void> {
		await clearCredentials(this.context, this.authCredentialsKey)
	}

	private async fetchUserInfo(): Promise<void> {
		if (!this.credentials) {
			return
		}

		this.userInfo = await clerkMeHelper(this.getClerkApiDeps())
		this.onUserInfo(this.userInfo)
	}

	getClerkApiDeps() {
		return {
			credentials: this.credentials,
			getStoredOrganizationId: () => this.getStoredOrganizationId(),
			log: (...args: unknown[]) => this.log(...args),
			context: this.context,
		}
	}
}
