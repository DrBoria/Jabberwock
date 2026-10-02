import * as http from "http"
import {
	OpenAiCodexCredentials,
	generateCodeVerifier,
	generateCodeChallenge,
	generateState,
	buildAuthorizationUrl,
} from "./protocol"
import { startOAuthCallbackServer } from "./callback-server"
import {
	loadCredentialsFromStorage,
	saveCredentialsToStorage,
	clearCredentialsFromStorage,
	refreshAndSaveCredentials,
	getValidAccessToken,
} from "./credentials"

/**
 * Minimal structural type for the host extension context.
 *
 * Captures only the members this module actually uses (the secret store), so the
 * file stays host-neutral and no longer imports "vscode". The real
 * `vscode.ExtensionContext` remains assignable because its `secrets` (SecretStorage)
 * is Thenable-based and Promise-compatible.
 */
interface IExtensionContextLike {
	secrets: {
		get(key: string): PromiseLike<string | undefined>
		store(key: string, value: string): PromiseLike<void>
		delete(key: string): PromiseLike<void>
	}
}

/**
 * OpenAiCodexOAuthManager - Handles OAuth flow and token management
 */
export function OpenAiCodexOAuthManager() {
	let context: IExtensionContextLike | null = null
	let credentials: OpenAiCodexCredentials | null = null
	let logFn: ((message: string) => void) | null = null
	let refreshPromise: Promise<OpenAiCodexCredentials> | null = null
	let pendingAuth: {
		codeVerifier: string
		state: string
		server?: http.Server
	} | null = null

	function log(message: string): void {
		if (logFn) {
			logFn(message)
		} else {
			console.log(message)
		}
	}

	function logError(message: string, error?: unknown): void {
		const details = error instanceof Error ? error.message : error !== undefined ? String(error) : undefined
		const full = details ? `${message} ${details}` : message
		log(full)
		console.error(`[jabberwock]`, full)
	}

	function initialize(ctx: IExtensionContextLike, lf?: (message: string) => void): void {
		context = ctx
		logFn = lf ?? null
	}

	async function forceRefreshAccessToken(): Promise<string | null> {
		if (!credentials) {
			await loadCredentials()
		}

		if (!credentials) {
			return null
		}

		return refreshAndSaveCredentials(
			credentials,
			context,
			(m: string) => log(m),
			(m: string, e?: unknown) => logError(m, e),
			{ current: refreshPromise },
		)
	}

	async function loadCredentials(): Promise<OpenAiCodexCredentials | null> {
		credentials = await loadCredentialsFromStorage(context)
		return credentials
	}

	async function saveCredentials(creds: OpenAiCodexCredentials): Promise<void> {
		await saveCredentialsToStorage(context, creds)
		credentials = creds
	}

	async function clearCredentials(): Promise<void> {
		await clearCredentialsFromStorage(context)
		credentials = null
	}

	async function getAccessToken(): Promise<string | null> {
		return getValidAccessToken(
			{ current: credentials },
			context,
			(m: string) => log(m),
			(m: string, e?: unknown) => logError(m, e),
			{ current: refreshPromise },
		)
	}

	async function getEmail(): Promise<string | null> {
		if (!credentials) {
			await loadCredentials()
		}
		return credentials?.email || null
	}

	async function getAccountId(): Promise<string | null> {
		if (!credentials) {
			await loadCredentials()
		}
		return credentials?.accountId || null
	}

	async function isAuthenticated(): Promise<boolean> {
		const token = await getAccessToken()
		return token !== null
	}

	function startAuthorizationFlow(): string {
		cancelAuthorizationFlow()

		const verifier = generateCodeVerifier()
		const challenge = generateCodeChallenge(verifier)
		const state = generateState()

		pendingAuth = {
			codeVerifier: verifier,
			state,
		}

		return buildAuthorizationUrl(challenge, state)
	}

	async function waitForCallback(): Promise<OpenAiCodexCredentials> {
		if (!pendingAuth) {
			throw new Error("No pending authorization flow")
		}

		if (pendingAuth.server) {
			try {
				pendingAuth.server.close()
			} catch {
				// Ignore errors when closing
			}
			pendingAuth.server = undefined
		}

		const auth = pendingAuth

		const creds = await startOAuthCallbackServer(auth, async (newCreds) => {
			await saveCredentials(newCreds)
		})

		pendingAuth = null
		return creds
	}

	function cancelAuthorizationFlow(): void {
		if (pendingAuth?.server) {
			pendingAuth.server.close()
		}
		pendingAuth = null
	}

	function getCredentials(): OpenAiCodexCredentials | null {
		return credentials
	}

	return {
		initialize,
		forceRefreshAccessToken,
		loadCredentials,
		saveCredentials,
		clearCredentials,
		getAccessToken,
		getEmail,
		getAccountId,
		isAuthenticated,
		startAuthorizationFlow,
		waitForCallback,
		cancelAuthorizationFlow,
		getCredentials,
	}
}

export type OpenAiCodexOAuthManager = ReturnType<typeof OpenAiCodexOAuthManager>

// Singleton instance
export const openAiCodexOAuthManager = OpenAiCodexOAuthManager()
