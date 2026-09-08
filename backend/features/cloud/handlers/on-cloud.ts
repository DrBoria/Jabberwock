import { EventBridge } from "@features/foundation/webview/EventBridge"
import { log as backendLog } from "@features/foundation/capabilities/backend-logger"
import { getBackendCapabilities } from "@features/foundation/capabilities/registry"
import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import { getTelemetryService } from "@jabberwock/telemetry"
import { IntentType, TelemetryEventName } from "@jabberwock/types"
import { getCloudService } from "@jabberwock/cloud"
import { getUiDialogs } from "@features/foundation/capabilities/registry"
import { getHostContext } from "@features/foundation/host-context/context"
import { t } from "@i18n"

import type { IntentBus } from "@features/intents/bus"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { openAiCodexOAuthManager } from "@integrations/openai-codex/oauth"

/**
 * Register all cloud-related intent handlers on the bus.
 */
export function registerOnCloud(bus: IntentBus): void {
	bus.register(IntentType.CloudButtonClicked, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		provider.postMessageToWebview({ type: "action", action: "cloudButtonClicked" })
	})

	bus.register(IntentType.CloudSignIn, async (intent, _ctx) => {
		try {
			const payload = intent.payload as { useProviderSignup?: boolean }
			getTelemetryService().captureEvent(TelemetryEventName.AUTHENTICATION_INITIATED)
			await getCloudService().login(undefined, payload.useProviderSignup ?? false)
		} catch (error) {
			backendLog.info(`AuthService#login failed: ${error}`)
			publishNotificationError("Sign in failed.")
		}
	})

	bus.register(IntentType.CloudLandingPageSignIn, async (intent, _ctx) => {
		try {
			const payload = intent.payload as { text?: string }
			const landingPageSlug = payload.text || "supernova"
			getTelemetryService().captureEvent(TelemetryEventName.AUTHENTICATION_INITIATED)
			await getCloudService().login(landingPageSlug)
		} catch (error) {
			backendLog.info(`CloudService#login failed: ${error}`)
			publishNotificationError("Sign in failed.")
		}
	})

	bus.register(IntentType.CloudSignOut, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			await getCloudService().logout()
			await postStateToWebview(provider)
			provider.postMessageToWebview({ type: "authenticatedUser", userInfo: undefined })
		} catch (error) {
			backendLog.info(`AuthService#logout failed: ${error}`)
			publishNotificationError("Sign out failed.")
		}
	})

	bus.register(IntentType.CloudManualUrl, handleCloudManualUrl)

	bus.register(IntentType.CloudOpenaiCodexSignIn, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const authUrl = openAiCodexOAuthManager.startAuthorizationFlow()

			// D4g-2 (batch 1): open the OAuth URL through the host-context command slot instead of a
			// direct "vscode" import (plan section 3.2 Strategy G).
			getHostContext()?.hostCommands?.openExternal?.(authUrl)

			openAiCodexOAuthManager
				.waitForCallback()
				.then(async () => {
					// D4g-2 (batch 1): toast through the uiDialogs capability slot (plan section 3.2 Strategy C).
					void getUiDialogs().showInformationMessage("Successfully signed in to OpenAI Codex")
					await postStateToWebview(provider)
				})
				.catch((error: unknown) => {
					backendLog.info(`OpenAI Codex OAuth callback failed: ${error}`)
					if (!String(error).includes("timed out")) {
						publishNotificationError(
							`OpenAI Codex sign in failed: ${(error as { message?: string }).message || error}`,
						)
					}
				})
		} catch (error) {
			backendLog.info(`OpenAI Codex OAuth failed: ${error}`)
			publishNotificationError("OpenAI Codex sign in failed.")
		}
	})

	bus.register(IntentType.CloudOpenaiCodexSignOut, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			await openAiCodexOAuthManager.clearCredentials()
			// D4g-2 (batch 1): toast through the uiDialogs capability slot (plan section 3.2 Strategy C).
			void getUiDialogs().showInformationMessage("Signed out from OpenAI Codex")
			await postStateToWebview(provider)
		} catch (error) {
			backendLog.info(`OpenAI Codex sign out failed: ${error}`)
			publishNotificationError("OpenAI Codex sign out failed.")
		}
	})

	bus.register(IntentType.CloudSwitchOrganization, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const payload = intent.payload as { organizationId?: string | null }
			const organizationId = payload.organizationId ?? null

			await getCloudService().switchOrganization(organizationId)

			await postStateToWebview(provider)

			await provider.postMessageToWebview({
				type: "organizationSwitchResult",
				success: true,
				organizationId,
			})
		} catch (error) {
			backendLog.info(`Organization switch failed: ${error}`)
			const errorMessage = error instanceof Error ? error.message : String(error)
			const payload = intent.payload as { organizationId?: string | null }

			await provider.postMessageToWebview({
				type: "organizationSwitchResult",
				success: false,
				error: errorMessage,
				organizationId: payload.organizationId ?? null,
			})

			publishNotificationError(`Failed to switch organization: ${errorMessage}`)
		}
	})

	bus.register(IntentType.CloudClearAuthSkipModel, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		// v4 B3: auth-skip flag now cleared via the injected hashmapMemory capability (§4.3) instead of provider.context.
		await getBackendCapabilities().hashmapMemory.delete("jabberwock-auth-skip-model")
		await postStateToWebview(provider)
	})
}

async function handleCloudManualUrl(
	intent: { id: string; type: string; payload: Record<string, unknown> },
	ctx: { provider?: EventBridge },
): Promise<void> {
	const provider = ctx.provider as ProviderHandle | undefined
	if (!provider) return

	try {
		await processCloudManualUrl(intent as { payload: { text?: string } }, provider)
	} catch (error) {
		backendLog.info(`ManualUrl#handleAuthCallback failed: ${error}`)
		const errorMessage = error instanceof Error ? error.message : t("common:errors.manual_url_auth_failed")

		publishNotificationError(`${t("common:errors.manual_url_error")}: ${errorMessage}`)
	}
}

async function processCloudManualUrl(intent: { payload: { text?: string } }, provider: ProviderHandle): Promise<void> {
	const payload = intent.payload as { text?: string }
	if (!payload.text) {
		publishNotificationError(t("common:errors.manual_url_empty"))
		return
	}

	const callbackUrl = payload.text.trim()
	// D4g-2 (batch 1): parse the callback URL with the platform-neutral WHATWG URL instead of
	// `vscode.Uri` (plan section 3.2 Strategy A).
	const uri = new URL(callbackUrl)

	if (!uri.search) {
		throw new Error(t("common:errors.manual_url_no_query"))
	}

	const query = new URLSearchParams(uri.search)
	const code = query.get("code")
	const state = query.get("state")
	const organizationId = query.get("organizationId")

	if (!code || !state) {
		throw new Error(t("common:errors.manual_url_missing_params"))
	}

	const normalizedOrgId = organizationId === "null" ? undefined : (organizationId ?? undefined)
	await getCloudService().handleAuthCallback(code, state, normalizedOrgId)

	await postStateToWebview(provider)
}

import { publishNotificationError } from "@features/foundation/capabilities/notifications"
