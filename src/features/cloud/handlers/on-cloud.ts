import { EventBridge } from "@features/foundation/webview/EventBridge"
import type { ProviderHandle } from "@features/foundation/webview/EventBridge"
import { getTelemetryService } from "@jabberwock/telemetry"
import { IntentType, TelemetryEventName } from "@jabberwock/types"
import { getCloudService } from "@jabberwock/cloud"
import * as vscode from "vscode"
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
			EventBridge.outputChannel?.appendLine(`AuthService#login failed: ${error}`)
			vscode.window.showErrorMessage("Sign in failed.")
		}
	})

	bus.register(IntentType.CloudLandingPageSignIn, async (intent, _ctx) => {
		try {
			const payload = intent.payload as { text?: string }
			const landingPageSlug = payload.text || "supernova"
			getTelemetryService().captureEvent(TelemetryEventName.AUTHENTICATION_INITIATED)
			await getCloudService().login(landingPageSlug)
		} catch (error) {
			EventBridge.outputChannel?.appendLine(`CloudService#login failed: ${error}`)
			vscode.window.showErrorMessage("Sign in failed.")
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
			EventBridge.outputChannel?.appendLine(`AuthService#logout failed: ${error}`)
			vscode.window.showErrorMessage("Sign out failed.")
		}
	})

	bus.register(IntentType.CloudManualUrl, handleCloudManualUrl)

	bus.register(IntentType.CloudOpenaiCodexSignIn, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const authUrl = openAiCodexOAuthManager.startAuthorizationFlow()

			await vscode.env.openExternal(vscode.Uri.parse(authUrl))

			openAiCodexOAuthManager
				.waitForCallback()
				.then(async () => {
					vscode.window.showInformationMessage("Successfully signed in to OpenAI Codex")
					await postStateToWebview(provider)
				})
				.catch((error: unknown) => {
					EventBridge.outputChannel?.appendLine(`OpenAI Codex OAuth callback failed: ${error}`)
					if (!String(error).includes("timed out")) {
						vscode.window.showErrorMessage(
							`OpenAI Codex sign in failed: ${(error as { message?: string }).message || error}`,
						)
					}
				})
		} catch (error) {
			EventBridge.outputChannel?.appendLine(`OpenAI Codex OAuth failed: ${error}`)
			vscode.window.showErrorMessage("OpenAI Codex sign in failed.")
		}
	})

	bus.register(IntentType.CloudOpenaiCodexSignOut, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			await openAiCodexOAuthManager.clearCredentials()
			vscode.window.showInformationMessage("Signed out from OpenAI Codex")
			await postStateToWebview(provider)
		} catch (error) {
			EventBridge.outputChannel?.appendLine(`OpenAI Codex sign out failed: ${error}`)
			vscode.window.showErrorMessage("OpenAI Codex sign out failed.")
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
			EventBridge.outputChannel?.appendLine(`Organization switch failed: ${error}`)
			const errorMessage = error instanceof Error ? error.message : String(error)
			const payload = intent.payload as { organizationId?: string | null }

			await provider.postMessageToWebview({
				type: "organizationSwitchResult",
				success: false,
				error: errorMessage,
				organizationId: payload.organizationId ?? null,
			})

			vscode.window.showErrorMessage(`Failed to switch organization: ${errorMessage}`)
		}
	})

	bus.register(IntentType.CloudClearAuthSkipModel, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		await provider.context.globalState.update("jabberwock-auth-skip-model", undefined)
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
		EventBridge.outputChannel?.appendLine(`ManualUrl#handleAuthCallback failed: ${error}`)
		const errorMessage = error instanceof Error ? error.message : t("common:errors.manual_url_auth_failed")

		vscode.window.showErrorMessage(`${t("common:errors.manual_url_error")}: ${errorMessage}`)
	}
}

async function processCloudManualUrl(intent: { payload: { text?: string } }, provider: ProviderHandle): Promise<void> {
	const payload = intent.payload as { text?: string }
	if (!payload.text) {
		vscode.window.showErrorMessage(t("common:errors.manual_url_empty"))
		return
	}

	const callbackUrl = payload.text.trim()
	const uri = vscode.Uri.parse(callbackUrl)

	if (!uri.query) {
		throw new Error(t("common:errors.manual_url_no_query"))
	}

	const query = new URLSearchParams(uri.query)
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
