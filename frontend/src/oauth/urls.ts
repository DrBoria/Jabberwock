import { Package } from "@shared/core/package"

/**
 * Compose the deep-link callback URL for an OAuth provider. Returns the raw
 * (unencoded) URL; callers `encodeURIComponent` it when embedding in a query
 * string.
 */
export function getCallbackUrl(provider: string, uriScheme?: string) {
	return `${uriScheme || "vscode"}://${Package.publisher}.${Package.name}/${provider}`
}

export function getOpenRouterAuthUrl(uriScheme?: string) {
	return `https://openrouter.ai/auth?callback_url=${encodeURIComponent(getCallbackUrl("openrouter", uriScheme))}`
}

export function getRequestyAuthUrl(uriScheme?: string) {
	return `https://app.requesty.ai/oauth/authorize?callback_url=${encodeURIComponent(
		getCallbackUrl("requesty", uriScheme),
	)}`
}
