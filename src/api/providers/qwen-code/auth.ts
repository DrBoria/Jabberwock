import { promises as fs } from "node:fs"
import * as os from "os"
import * as path from "path"

export const QWEN_OAUTH_BASE_URL = "https://chat.qwen.ai"
export const QWEN_OAUTH_TOKEN_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/token`
export const QWEN_OAUTH_CLIENT_ID = "f0304373b74a44d2b584a3fb70ca9e56"
const QWEN_DIR = ".qwen"
const QWEN_CREDENTIAL_FILENAME = "oauth_creds.json"

export interface QwenOAuthCredentials {
	access_token: string
	refresh_token: string
	token_type: string
	expiry_date: number
	resource_url?: string
}

export function getQwenCachedCredentialPath(customPath?: string): string {
	if (customPath) {
		// Support custom path that starts with ~/ or is absolute
		if (customPath.startsWith("~/")) {
			return path.join(os.homedir(), customPath.slice(2))
		}
		return path.resolve(customPath)
	}
	return path.join(os.homedir(), QWEN_DIR, QWEN_CREDENTIAL_FILENAME)
}

function objectToUrlEncoded(data: Record<string, string>): string {
	return Object.keys(data)
		.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
		.join("&")
}

export async function loadCachedQwenCredentials(oauthPath?: string): Promise<QwenOAuthCredentials> {
	try {
		const keyFile = getQwenCachedCredentialPath(oauthPath)
		const credsStr = await fs.readFile(keyFile, "utf-8")
		return JSON.parse(credsStr)
	} catch (error) {
		console.error(`Error reading or parsing credentials file at ${getQwenCachedCredentialPath(oauthPath)}`)
		throw new Error(`Failed to load Qwen OAuth credentials: ${error}`)
	}
}

export async function doRefreshAccessToken(
	credentials: QwenOAuthCredentials,
	oauthPath?: string,
): Promise<QwenOAuthCredentials> {
	if (!credentials.refresh_token) {
		throw new Error("No refresh token available in credentials.")
	}

	const bodyData = {
		grant_type: "refresh_token",
		refresh_token: credentials.refresh_token,
		client_id: QWEN_OAUTH_CLIENT_ID,
	}

	const response = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Accept: "application/json",
		},
		body: objectToUrlEncoded(bodyData),
	})

	if (!response.ok) {
		const errorText = await response.text()
		throw new Error(`Token refresh failed: ${response.status} ${response.statusText}. Response: ${errorText}`)
	}

	const tokenData = await response.json()

	if (tokenData.error) {
		throw new Error(`Token refresh failed: ${tokenData.error} - ${tokenData.error_description}`)
	}

	const newCredentials = {
		...credentials,
		access_token: tokenData.access_token,
		token_type: tokenData.token_type,
		refresh_token: tokenData.refresh_token || credentials.refresh_token,
		expiry_date: Date.now() + tokenData.expires_in * 1000,
	}

	const filePath = getQwenCachedCredentialPath(oauthPath)
	try {
		await fs.writeFile(filePath, JSON.stringify(newCredentials, null, 2))
	} catch (error) {
		console.error("[jabberwock] Failed to save refreshed credentials:", error)
		// Continue with the refreshed token in memory even if file write fails
	}

	return newCredentials
}

export function isTokenValid(credentials: QwenOAuthCredentials): boolean {
	const TOKEN_REFRESH_BUFFER_MS = 30 * 1000 // 30s buffer
	if (!credentials.expiry_date) {
		return false
	}
	return Date.now() < credentials.expiry_date - TOKEN_REFRESH_BUFFER_MS
}
