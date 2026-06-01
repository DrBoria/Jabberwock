import delay from "delay"

import type { StreamHandle, AttemptApiRequestCallbacks } from "../../../chat/task/condense/actions/types"

import type { IBackendRootStore } from "../../../store"

/**
 * Get the current profile ID from the MST settings store.
 */
export function getCurrentProfileId(store: IBackendRootStore): string {
	const apiConfig = store.settings?.apiConfig
	const list = apiConfig?.listApiConfigMeta ?? []
	const currentName = apiConfig?.currentConfigName ?? "default"
	return list.find((profile: { name: string; id?: string }) => profile.name === currentName)?.id ?? "default"
}

/**
 * Enforce the user-configured provider rate limit.
 */
export async function maybeWaitForProviderRateLimit(
	task: StreamHandle,
	callbacks: AttemptApiRequestCallbacks,
	retryAttempt: number,
): Promise<void> {
	const rateLimitSeconds =
		((task.apiConfiguration as { [key: string]: unknown } | undefined)?.rateLimitSeconds as number) ?? 0

	if (rateLimitSeconds <= 0 || !task.lastApiRequestTime) {
		return
	}

	const now = performance.now()
	const lastRequestTime = task.lastApiRequestTime as number
	const timeSinceLastRequest = now - lastRequestTime
	const rateLimitDelay = Math.ceil(
		Math.min(rateLimitSeconds, Math.max(0, rateLimitSeconds * 1000 - timeSinceLastRequest) / 1000),
	)

	// Only show the countdown UX on the first attempt. Retry flows have their own delay messaging.
	if (rateLimitDelay > 0 && retryAttempt === 0) {
		for (let i = rateLimitDelay; i > 0; i--) {
			// Send structured JSON data for i18n-safe transport
			const delayMessage = JSON.stringify({ seconds: i })
			await callbacks.say("api_req_rate_limit_wait", delayMessage, undefined, true)
			await delay(1000)
		}
		// Finalize the partial message so the UI doesn't keep rendering an in-progress spinner.
		await callbacks.say("api_req_rate_limit_wait", undefined, undefined, false)
	}
}
