import type { ExtensionContext } from "vscode"
import {
	OPENAI_CODEX_CREDENTIALS_KEY,
	openAiCodexCredentialsSchema,
	OpenAiCodexCredentials,
	refreshAccessToken,
	isTokenExpired,
	LogFunction,
} from "./oauthHelpers"
import { OpenAiCodexOAuthTokenError } from "./oauthTokenParsing"

export async function loadCredentialsFromStorage(
	context: ExtensionContext | null,
): Promise<OpenAiCodexCredentials | null> {
	if (!context) {
		return null
	}

	try {
		const credentialsJson = await context.secrets.get(OPENAI_CODEX_CREDENTIALS_KEY)
		if (!credentialsJson) {
			return null
		}

		return openAiCodexCredentialsSchema.parse(JSON.parse(credentialsJson))
	} catch (error) {
		console.error("[openai-codex-oauth] Failed to load credentials:", error)
		return null
	}
}

export async function saveCredentialsToStorage(
	context: ExtensionContext | null,
	credentials: OpenAiCodexCredentials,
): Promise<void> {
	if (!context) {
		throw new Error("OAuth manager not initialized")
	}

	await context.secrets.store(OPENAI_CODEX_CREDENTIALS_KEY, JSON.stringify(credentials))
}

export async function clearCredentialsFromStorage(context: ExtensionContext | null): Promise<void> {
	if (!context) {
		return
	}

	await context.secrets.delete(OPENAI_CODEX_CREDENTIALS_KEY)
}

export async function refreshAndSaveCredentials(
	credentials: OpenAiCodexCredentials,
	context: ExtensionContext | null,
	log: LogFunction,
	logError: (message: string, error?: unknown) => void,
	refreshPromiseRef: { current: Promise<OpenAiCodexCredentials> | null },
): Promise<string | null> {
	if (!refreshPromiseRef.current) {
		const prevRefreshToken = credentials.refresh_token
		log(`[openai-codex-oauth] Forcing token refresh (expires=${credentials.expires})...`)
		refreshPromiseRef.current = refreshAccessToken(credentials).then((newCreds) => {
			const rotated = newCreds.refresh_token !== prevRefreshToken
			log(
				`[openai-codex-oauth] Refresh response received (expires_in≈${Math.round(
					(newCreds.expires - Date.now()) / 1000,
				)}s, refresh_token_rotated=${rotated})`,
			)
			return newCreds
		})
	}

	try {
		const newCredentials = await refreshPromiseRef.current
		refreshPromiseRef.current = null
		await saveCredentialsToStorage(context, newCredentials)
		log(`[openai-codex-oauth] Token persisted (expires=${newCredentials.expires})`)
		return newCredentials.access_token
	} catch (error) {
		refreshPromiseRef.current = null
		logError("[openai-codex-oauth] Failed to refresh token:", error)

		if (error instanceof OpenAiCodexOAuthTokenError && error.isLikelyInvalidGrant()) {
			log("[openai-codex-oauth] Refresh token appears invalid; clearing stored credentials")
			await clearCredentialsFromStorage(context)
		}
		return null
	}
}

export async function getValidAccessToken(
	credentialsRef: { current: OpenAiCodexCredentials | null },
	context: ExtensionContext | null,
	log: LogFunction,
	logError: (message: string, error?: unknown) => void,
	refreshPromiseRef: { current: Promise<OpenAiCodexCredentials> | null },
): Promise<string | null> {
	if (!credentialsRef.current) {
		const loaded = await loadCredentialsFromStorage(context)
		if (!loaded) {
			return null
		}
		credentialsRef.current = loaded
	}

	if (isTokenExpired(credentialsRef.current)) {
		return refreshAndSaveCredentials(credentialsRef.current, context, log, logError, refreshPromiseRef)
	}

	return credentialsRef.current.access_token
}
