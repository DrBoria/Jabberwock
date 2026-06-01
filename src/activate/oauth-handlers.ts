import { getSettingsAccess } from "@utils/settings-access"

/**
 * Exchanges an OpenRouter OAuth authorization code for an API key
 * and stores it via ContextProxy.
 *
 * OpenRouter OAuth flow:
 *   1. User visits https://openrouter.ai/auth?callback=<vscode-uri>
 *   2. User authorizes the app
 *   3. OpenRouter redirects to vscode://…/openrouter?code=<code>
 *   4. This function exchanges the code for an API key at POST /api/v1/auth/keys
 */
export async function handleOpenRouterCallback(code: string): Promise<void> {
	const response = await fetch("https://openrouter.ai/api/v1/auth/keys", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ code }),
	})

	if (!response.ok) {
		throw new Error(`OpenRouter token exchange failed: ${response.status} ${response.statusText}`)
	}

	const data = (await response.json()) as { key?: string }
	const apiKey = data.key

	if (!apiKey) {
		throw new Error("OpenRouter token exchange returned no API key")
	}

	const proxy = getSettingsAccess()
	await proxy.setProviderSettings({ openRouterApiKey: apiKey })
}

/**
 * Exchanges a Requesty OAuth authorization code for an API key
 * and stores it via ContextProxy.
 */
export async function handleRequestyCallback(code: string, baseUrl: string | null): Promise<void> {
	const endpoint = (baseUrl ?? "https://requesty.ai").replace(/\/+$/, "") + "/api/v1/auth/keys"

	const response = await fetch(endpoint, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ code }),
	})

	if (!response.ok) {
		throw new Error(`Requesty token exchange failed: ${response.status} ${response.statusText}`)
	}

	const data = (await response.json()) as { key?: string }
	const apiKey = data.key

	if (!apiKey) {
		throw new Error("Requesty token exchange returned no API key")
	}

	const proxy = getSettingsAccess()
	await proxy.setProviderSettings({ requestyApiKey: apiKey })
}
