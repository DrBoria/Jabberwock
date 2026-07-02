import * as http from "http"
import type { ExtensionContext } from "vscode"
import {
	OpenAiCodexCredentials,
	generateCodeVerifier,
	generateCodeChallenge,
	generateState,
	buildAuthorizationUrl,
	isTokenExpired,
} from "./oauthHelpers"
import { startOAuthCallbackServer } from "./oauthCallbackServer"
import {
	loadCredentialsFromStorage,
	saveCredentialsToStorage,
	clearCredentialsFromStorage,
	refreshAndSaveCredentials,
	getValidAccessToken,
} from "./oauthTokenManager"

/**
 * OpenAiCodexOAuthManager - Handles OAuth flow and token management
 */
export class OpenAiCodexOAuthManager {
	private context: ExtensionContext | null = null
	private credentials: OpenAiCodexCredentials | null = null
	private logFn: ((message: string) => void) | null = null
	private refreshPromise: Promise<OpenAiCodexCredentials> | null = null
	private pendingAuth: {
		codeVerifier: string
		state: string
		server?: http.Server
	} | null = null

	private log(message: string): void {
		if (this.logFn) {
			this.logFn(message)
		} else {
			console.log(message)
		}
	}

	private logError(message: string, error?: unknown): void {
		const details = error instanceof Error ? error.message : error !== undefined ? String(error) : undefined
		const full = details ? `${message} ${details}` : message
		this.log(full)
		console.error(`[jabberwock]`, full)
	}

	initialize(context: ExtensionContext, logFn?: (message: string) => void): void {
		this.context = context
		this.logFn = logFn ?? null
	}

	async forceRefreshAccessToken(): Promise<string | null> {
		if (!this.credentials) {
			await this.loadCredentials()
		}

		if (!this.credentials) {
			return null
		}

		return refreshAndSaveCredentials(
			this.credentials,
			this.context,
			(m: string) => this.log(m),
			(m: string, e?: unknown) => this.logError(m, e),
			{ current: this.refreshPromise },
		)
	}

	async loadCredentials(): Promise<OpenAiCodexCredentials | null> {
		this.credentials = await loadCredentialsFromStorage(this.context)
		return this.credentials
	}

	async saveCredentials(credentials: OpenAiCodexCredentials): Promise<void> {
		await saveCredentialsToStorage(this.context, credentials)
		this.credentials = credentials
	}

	async clearCredentials(): Promise<void> {
		await clearCredentialsFromStorage(this.context)
		this.credentials = null
	}

	async getAccessToken(): Promise<string | null> {
		return getValidAccessToken(
			{ current: this.credentials },
			this.context,
			(m: string) => this.log(m),
			(m: string, e?: unknown) => this.logError(m, e),
			{ current: this.refreshPromise },
		)
	}

	async getEmail(): Promise<string | null> {
		if (!this.credentials) {
			await this.loadCredentials()
		}
		return this.credentials?.email || null
	}

	async getAccountId(): Promise<string | null> {
		if (!this.credentials) {
			await this.loadCredentials()
		}
		return this.credentials?.accountId || null
	}

	async isAuthenticated(): Promise<boolean> {
		const token = await this.getAccessToken()
		return token !== null
	}

	startAuthorizationFlow(): string {
		this.cancelAuthorizationFlow()

		const codeVerifier = generateCodeVerifier()
		const codeChallenge = generateCodeChallenge(codeVerifier)
		const state = generateState()

		this.pendingAuth = {
			codeVerifier,
			state,
		}

		return buildAuthorizationUrl(codeChallenge, state)
	}

	async waitForCallback(): Promise<OpenAiCodexCredentials> {
		if (!this.pendingAuth) {
			throw new Error("No pending authorization flow")
		}

		if (this.pendingAuth.server) {
			try {
				this.pendingAuth.server.close()
			} catch {
				// Ignore errors when closing
			}
			this.pendingAuth.server = undefined
		}

		const auth = this.pendingAuth

		const credentials = await startOAuthCallbackServer(auth, async (creds) => {
			await this.saveCredentials(creds)
		})

		this.pendingAuth = null
		return credentials
	}

	cancelAuthorizationFlow(): void {
		if (this.pendingAuth?.server) {
			this.pendingAuth.server.close()
		}
		this.pendingAuth = null
	}

	getCredentials(): OpenAiCodexCredentials | null {
		return this.credentials
	}
}

// Singleton instance
export const openAiCodexOAuthManager = new OpenAiCodexOAuthManager()
