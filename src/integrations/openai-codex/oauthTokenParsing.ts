/**
 * OpenAI Codex OAuth token parsing utilities
 */

interface IdTokenClaims {
	chatgpt_account_id?: string
	organizations?: Array<{ id: string }>
	email?: string
	"https://api.openai.com/auth"?: {
		chatgpt_account_id?: string
	}
}

/**
 * Parse JWT claims from a token
 */
function parseJwtClaims(token: string): IdTokenClaims | undefined {
	const parts = token.split(".")
	if (parts.length !== 3) return undefined
	try {
		const payload = Buffer.from(parts[1], "base64url").toString("utf-8")
		return JSON.parse(payload) as IdTokenClaims
	} catch {
		return undefined
	}
}

/**
 * Extract ChatGPT account ID from JWT claims
 */
function extractAccountIdFromClaims(claims: IdTokenClaims): string | undefined {
	return (
		claims.chatgpt_account_id ||
		claims["https://api.openai.com/auth"]?.chatgpt_account_id ||
		claims.organizations?.[0]?.id
	)
}

/**
 * Extract ChatGPT account ID from token response
 */
export function extractAccountId(tokens: { id_token?: string; access_token: string }): string | undefined {
	if (tokens.id_token) {
		const claims = parseJwtClaims(tokens.id_token)
		const accountId = claims && extractAccountIdFromClaims(claims)
		if (accountId) return accountId
	}
	if (tokens.access_token) {
		const claims = parseJwtClaims(tokens.access_token)
		return claims ? extractAccountIdFromClaims(claims) : undefined
	}
	return undefined
}

export class OpenAiCodexOAuthTokenError extends Error {
	public readonly status?: number
	public readonly errorCode?: string

	constructor(message: string, opts?: { status?: number; errorCode?: string }) {
		super(message)
		this.name = "OpenAiCodexOAuthTokenError"
		this.status = opts?.status
		this.errorCode = opts?.errorCode
	}

	public isLikelyInvalidGrant(): boolean {
		if (this.errorCode && /invalid_grant/i.test(this.errorCode)) {
			return true
		}
		if (this.status === 400 || this.status === 401 || this.status === 403) {
			return /invalid_grant|revoked|expired|invalid refresh/i.test(this.message)
		}
		return false
	}
}

function extractOAuthErrorCode(errorField: unknown): string | undefined {
	if (typeof errorField === "string") {
		return errorField
	}

	if (errorField && typeof errorField === "object") {
		const field = errorField as Record<string, unknown>
		if (typeof field.type === "string") {
			return field.type
		}
	}

	return undefined
}

function extractOAuthErrorMessage(obj: Record<string, unknown>, errorField: unknown): string | undefined {
	const errorDescription = obj.error_description
	if (typeof errorDescription === "string") {
		return errorDescription
	}

	if (errorField && typeof errorField === "object") {
		const field = errorField as Record<string, unknown>
		if (typeof field.message === "string") {
			return field.message
		}
	}

	if (typeof obj.message === "string") {
		return obj.message
	}

	return undefined
}

export function parseOAuthErrorDetails(errorText: string): { errorCode?: string; errorMessage?: string } {
	try {
		const json: unknown = JSON.parse(errorText)
		if (!json || typeof json !== "object") {
			return {}
		}

		const obj = json as Record<string, unknown>
		const errorField = obj.error

		const errorCode = extractOAuthErrorCode(errorField)
		const errorMessage = extractOAuthErrorMessage(obj, errorField)

		return { errorCode, errorMessage }
	} catch {
		return {}
	}
}
