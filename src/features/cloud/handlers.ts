import type { EventBridge } from "../../core/webview/EventBridge"
import type { WebviewMessage } from "@jabberwock/types"
import { TelemetryService, getTelemetryService, hasTelemetryService } from "@jabberwock/telemetry"
import { TelemetryEventName } from "@jabberwock/types"
import { CloudService, getCloudService, hasCloudService } from "@jabberwock/cloud"
import * as vscode from "vscode"
import { t } from "../../i18n"

import { postStateToWebview } from "../foundation/window-manager/store"
export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

export const handlerMap: Record<string, HandlerFn> = {
	cloudButtonClicked: async (provider, _message) => {
		provider.postMessageToWebview({ type: "action", action: "cloudButtonClicked" })
	},

	jabberwockCloudSignIn: async (provider, message) => {
		try {
			getTelemetryService().captureEvent(TelemetryEventName.AUTHENTICATION_INITIATED)
			await getCloudService().login(undefined, message.useProviderSignup ?? false)
		} catch (error) {
			provider.log(`AuthService#login failed: ${error}`)
			vscode.window.showErrorMessage("Sign in failed.")
		}
	},

	cloudLandingPageSignIn: async (provider, message) => {
		try {
			const landingPageSlug = message.text || "supernova"
			getTelemetryService().captureEvent(TelemetryEventName.AUTHENTICATION_INITIATED)
			await getCloudService().login(landingPageSlug)
		} catch (error) {
			provider.log(`CloudService#login failed: ${error}`)
			vscode.window.showErrorMessage("Sign in failed.")
		}
	},

	jabberwockCloudSignOut: async (provider, _message) => {
		try {
			await getCloudService().logout()
			await postStateToWebview(provider)
			provider.postMessageToWebview({ type: "authenticatedUser", userInfo: undefined })
		} catch (error) {
			provider.log(`AuthService#logout failed: ${error}`)
			vscode.window.showErrorMessage("Sign out failed.")
		}
	},

	jabberwockCloudManualUrl: async (provider, message) => {
		try {
			if (!message.text) {
				vscode.window.showErrorMessage(t("common:errors.manual_url_empty"))
				return
			}

			const callbackUrl = message.text.trim()
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

			await getCloudService().handleAuthCallback(
				code,
				state,
				organizationId === "null" ? undefined : (organizationId ?? undefined),
			)

			await postStateToWebview(provider)
		} catch (error) {
			provider.log(`ManualUrl#handleAuthCallback failed: ${error}`)
			const errorMessage = error instanceof Error ? error.message : t("common:errors.manual_url_auth_failed")

			vscode.window.showErrorMessage(`${t("common:errors.manual_url_auth_error")}: ${errorMessage}`)
		}
	},

	openAiCodexSignIn: async (provider, message) => {
		try {
			const { openAiCodexOAuthManager } = await import("../../integrations/openai-codex/oauth")
			const authUrl = openAiCodexOAuthManager.startAuthorizationFlow()

			await vscode.env.openExternal(vscode.Uri.parse(authUrl))

			openAiCodexOAuthManager
				.waitForCallback()
				.then(async () => {
					vscode.window.showInformationMessage("Successfully signed in to OpenAI Codex")
					await postStateToWebview(provider)
				})
				.catch((error: unknown) => {
					provider.log(`OpenAI Codex OAuth callback failed: ${error}`)
					if (!String(error).includes("timed out")) {
						vscode.window.showErrorMessage(
							`OpenAI Codex sign in failed: ${(error as { message?: string }).message || error}`,
						)
					}
				})
		} catch (error) {
			provider.log(`OpenAI Codex OAuth failed: ${error}`)
			vscode.window.showErrorMessage("OpenAI Codex sign in failed.")
		}
	},

	openAiCodexSignOut: async (provider, _message) => {
		try {
			const { openAiCodexOAuthManager } = await import("../../integrations/openai-codex/oauth")
			await openAiCodexOAuthManager.clearCredentials()
			vscode.window.showInformationMessage("Signed out from OpenAI Codex")
			await postStateToWebview(provider)
		} catch (error) {
			provider.log(`OpenAI Codex sign out failed: ${error}`)
			vscode.window.showErrorMessage("OpenAI Codex sign out failed.")
		}
	},

	switchOrganization: async (provider, message) => {
		try {
			const organizationId = message.organizationId ?? null

			await getCloudService().switchOrganization(organizationId)

			await postStateToWebview(provider)

			await provider.postMessageToWebview({
				type: "organizationSwitchResult",
				success: true,
				organizationId: organizationId,
			})
		} catch (error) {
			provider.log(`Organization switch failed: ${error}`)
			const errorMessage = error instanceof Error ? error.message : String(error)

			await provider.postMessageToWebview({
				type: "organizationSwitchResult",
				success: false,
				error: errorMessage,
				organizationId: message.organizationId ?? null,
			})

			vscode.window.showErrorMessage(`Failed to switch organization: ${errorMessage}`)
		}
	},

	clearCloudAuthSkipModel: async (provider, _message) => {
		await provider.context.globalState.update("jabberwock-auth-skip-model", undefined)
		await postStateToWebview(provider)
	},
}
