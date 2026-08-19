import { FlagOptions, CliSettings, OnboardingProviderChoice, SDK_BASE_URL } from "@/types/index.js"

import { createClient } from "@/lib/sdk/index.js"
import { loadToken } from "@/lib/storage/index.js"
import { getApiKeyFromEnv } from "@/lib/utils/validation/provider.js"
import { runOnboarding } from "@/lib/utils/onboarding.js"

import type { ExtensionHostOptions } from "@/agent/index.js"
import { failWithUsage } from "../helpers/errors.js"

export async function handleOnboarding(
	f: FlagOptions,
	s: CliSettings,
): Promise<{ rooToken: string | null; provider: string | undefined }> {
	const rooToken = await loadToken()
	let c = s.onboardingProviderChoice
	if (!c && rooToken) {
		c = OnboardingProviderChoice.Jabberwock
	}
	if (c) {
		return { rooToken, provider: c === OnboardingProviderChoice.Jabberwock ? "jabberwock" : undefined }
	}
	const { choice, token } = await runOnboarding()
	return {
		rooToken: token ?? null,
		provider: choice === OnboardingProviderChoice.Jabberwock ? "jabberwock" : undefined,
	}
}

export async function handleJabberwockAuth(
	e: ExtensionHostOptions,
	rooToken: string | null,
	f: FlagOptions,
): Promise<void> {
	if (e.provider !== "jabberwock" || !rooToken) return
	try {
		const client = createClient({ url: SDK_BASE_URL, authToken: rooToken })
		const me = await client.auth.me.query()
		if (me?.type !== "user") {
			throw new Error("Invalid token")
		}
		e.apiKey = rooToken
		e.user = me.user
	} catch {
		if (!f.apiKey && !getApiKeyFromEnv(e.provider)) {
			failWithUsage("Your Jabberwock Router token is not valid.", "Please run: jabberwock auth login")
		}
	}
}
