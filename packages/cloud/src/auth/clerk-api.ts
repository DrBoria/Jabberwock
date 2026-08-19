import type { CloudUserInfo } from "@jabberwock/types"

import { getClerkBaseUrl } from "../config.ts"
import { getUserAgent } from "../utils.ts"
import { InvalidClientTokenError } from "../errors.ts"
import {
	type AuthCredentials,
	authCredentialsSchema,
	clerkSignInResponseSchema,
	clerkCreateSessionTokenResponseSchema,
	clerkMeResponseSchema,
} from "./web-auth-schemas.ts"
import {
	type ClerkApiDependencies,
	buildUserInfoFromClerkData,
	enrichWithOrganizationInfo,
} from "./clerk-api-enrichment.ts"

export async function clerkSignIn(ticket: string, deps: ClerkApiDependencies): Promise<AuthCredentials> {
	const formData = new URLSearchParams()
	formData.append("strategy", "ticket")
	formData.append("ticket", ticket)

	const response = await fetch(`${getClerkBaseUrl()}/v1/client/sign_ins`, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"User-Agent": getUserAgent(deps.context),
		},
		body: formData.toString(),
		signal: AbortSignal.timeout(10000),
	})

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`)
	}

	const {
		response: { created_session_id: sessionId },
	} = clerkSignInResponseSchema.parse(await response.json())

	const clientToken = response.headers.get("authorization")

	if (!clientToken) {
		throw new Error("No authorization header found in the response")
	}

	return authCredentialsSchema.parse({ clientToken, sessionId })
}

export async function clerkCreateSessionToken(
	credentials: AuthCredentials,
	deps: ClerkApiDependencies,
): Promise<string> {
	const formData = new URLSearchParams()
	formData.append("_is_native", "1")

	const organizationId = deps.getStoredOrganizationId()
	if (credentials.organizationId !== undefined) {
		formData.append("organization_id", organizationId || "")
	}

	const response = await fetch(`${getClerkBaseUrl()}/v1/client/sessions/${credentials.sessionId}/tokens`, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Authorization: `Bearer ${credentials.clientToken}`,
			"User-Agent": getUserAgent(deps.context),
		},
		body: formData.toString(),
		signal: AbortSignal.timeout(10000),
	})

	if (response.status === 401 || response.status === 404) {
		throw new InvalidClientTokenError()
	} else if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`)
	}

	const data = clerkCreateSessionTokenResponseSchema.parse(await response.json())

	return data.jwt
}

export async function clerkMe(deps: ClerkApiDependencies): Promise<CloudUserInfo> {
	if (!deps.credentials) {
		throw new Error("No credentials available")
	}

	const response = await fetch(`${getClerkBaseUrl()}/v1/me`, {
		headers: {
			Authorization: `Bearer ${deps.credentials.clientToken}`,
			"User-Agent": getUserAgent(deps.context),
		},
		signal: AbortSignal.timeout(10000),
	})

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`)
	}

	const payload = await response.json()
	const { response: userData } = clerkMeResponseSchema.parse(payload)

	const userInfo = buildUserInfoFromClerkData(userData as Record<string, unknown>)

	await enrichWithOrganizationInfo(userInfo, deps)

	return userInfo
}

export async function clerkLogout(credentials: AuthCredentials, deps: ClerkApiDependencies): Promise<void> {
	const formData = new URLSearchParams()
	formData.append("_is_native", "1")

	const response = await fetch(`${getClerkBaseUrl()}/v1/client/sessions/${credentials.sessionId}/remove`, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Authorization: `Bearer ${credentials.clientToken}`,
			"User-Agent": getUserAgent(deps.context),
		},
		body: formData.toString(),
		signal: AbortSignal.timeout(10000),
	})

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`)
	}
}
