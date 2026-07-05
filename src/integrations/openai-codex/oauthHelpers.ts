import * as crypto from "crypto"
import { URL } from "url"
import { z } from "zod"

/**
 * OpenAI Codex OAuth Configuration
 */
import { OpenAiCodexOAuthTokenError, parseOAuthErrorDetails } from "./oauthTokenParsing"

export const OPENAI_CODEX_OAUTH_CONFIG = {
	authorizationEndpoint: "https://auth.openai.com/oauth/authorize",
	tokenEndpoint: "https://auth.openai.com/oauth/token",
	clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
	redirectUri: "http://localhost:1455/auth/callback",
	scopes: "openid profile email offline_access",
	callbackPort: 1455,
} as const

export const OPENAI_CODEX_CREDENTIALS_KEY = "openai-codex-oauth-credentials"

export const openAiCodexCredentialsSchema = z.object({
	type: z.literal("openai-codex"),
	access_token: z.string().min(1),
	refresh_token: z.string().min(1),
	expires: z.number(),
	email: z.string().optional(),
	accountId: z.string().optional(),
})

export type OpenAiCodexCredentials = z.infer<typeof openAiCodexCredentialsSchema>

const tokenResponseSchema = z.object({
	access_token: z.string(),
	refresh_token: z.string().min(1).optional(),
	id_token: z.string().optional(),
	expires_in: z.number(),
	email: z.string().optional(),
	token_type: z.string().optional(),
})

/**
 * Generates a cryptographically random PKCE code verifier
 */
export function generateCodeVerifier(): string {
	const buffer = crypto.randomBytes(32)
	return buffer.toString("base64url")
}

/**
 * Generates the PKCE code challenge from the verifier using S256 method
 */
export function generateCodeChallenge(verifier: string): string {
	const hash = crypto.createHash("sha256").update(verifier).digest()
	return hash.toString("base64url")
}

/**
 * Generates a random state parameter for CSRF protection
 */
export function generateState(): string {
	const buffer = crypto.randomBytes(32)
	return buffer.toString("base64url")
}

/**
 * Builds the OAuth authorization URL with PKCE challenge and state
 */
export function buildAuthorizationUrl(codeChallenge: string, state: string): string {
	const url = new URL(OPENAI_CODEX_OAUTH_CONFIG.authorizationEndpoint)

	url.searchParams.set("response_type", "code")
	url.searchParams.set("client_id", OPENAI_CODEX_OAUTH_CONFIG.clientId)
	url.searchParams.set("redirect_uri", OPENAI_CODEX_OAUTH_CONFIG.redirectUri)
	url.searchParams.set("scope", OPENAI_CODEX_OAUTH_CONFIG.scopes)
	url.searchParams.set("code_challenge", codeChallenge)
	url.searchParams.set("code_challenge_method", "S256")
	url.searchParams.set("state", state)

	return url.toString()
}

export type LogFunction = (message: string) => void

/**
 * Exchanges an authorization code for tokens using PKCE
 */
export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<OpenAiCodexCredentials> {
	const params = new URLSearchParams({
		grant_type: "authorization_code",
		code,
		redirect_uri: OPENAI_CODEX_OAUTH_CONFIG.redirectUri,
		client_id: OPENAI_CODEX_OAUTH_CONFIG.clientId,
		code_verifier: codeVerifier,
	})

	const response = await fetch(OPENAI_CODEX_OAUTH_CONFIG.tokenEndpoint, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: params.toString(),
	})

	if (!response.ok) {
		const errorBody = await response.text().catch(() => "Unknown error")
		throw new OpenAiCodexOAuthTokenError(`Token exchange failed: ${response.status} ${errorBody}`)
	}

	const tokenResponse = tokenResponseSchema.parse(await response.json())

	return {
		type: "openai-codex",
		access_token: tokenResponse.access_token,
		refresh_token: tokenResponse.refresh_token ?? "",
		expires: Date.now() + tokenResponse.expires_in * 1000,
		email: tokenResponse.email,
	}
}

/**
 * Refreshes an access token using the refresh token
 */
export async function refreshAccessToken(credentials: OpenAiCodexCredentials): Promise<OpenAiCodexCredentials> {
	const params = new URLSearchParams({
		grant_type: "refresh_token",
		refresh_token: credentials.refresh_token,
		client_id: OPENAI_CODEX_OAUTH_CONFIG.clientId,
	})

	const response = await fetch(OPENAI_CODEX_OAUTH_CONFIG.tokenEndpoint, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: params.toString(),
	})

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error")
		const errorDetails = parseOAuthErrorDetails(errorText)
		throw new OpenAiCodexOAuthTokenError(errorDetails.errorMessage ?? `Token refresh failed: ${response.status}`, {
			errorCode: errorDetails.errorCode,
		})
	}

	const tokenResponse = tokenResponseSchema.parse(await response.json())

	return {
		type: "openai-codex",
		access_token: tokenResponse.access_token,
		refresh_token: tokenResponse.refresh_token ?? credentials.refresh_token,
		expires: Date.now() + tokenResponse.expires_in * 1000,
		email: tokenResponse.email ?? credentials.email,
	}
}

/**
 * Checks if the access token is expired
 */
export function isTokenExpired(credentials: OpenAiCodexCredentials): boolean {
	return Date.now() >= credentials.expires - 60_000
}
