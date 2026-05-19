import * as vscode from "vscode"

import { CloudService, getCloudService, hasCloudService } from "@jabberwock/cloud"

import { EventBridge } from "../core/webview/EventBridge"

export const handleUri = async (uri: vscode.Uri) => {
	const path = uri.path
	const query = new URLSearchParams(uri.query.replace(/\+/g, "%2B"))
	const visibleProvider = await EventBridge.getVisibleInstance()

	if (!visibleProvider) {
		return
	}

	switch (path) {
		case "/openrouter": {
			const code = query.get("code")
			if (code && visibleProvider.handleOpenRouterCallback) {
				await visibleProvider.handleOpenRouterCallback(code)
			}
			break
		}
		case "/requesty": {
			const code = query.get("code")
			const baseUrl = query.get("baseUrl")
			if (code && visibleProvider.handleRequestyCallback) {
				await visibleProvider.handleRequestyCallback(code, baseUrl)
			}
			break
		}
		case "/auth/clerk/callback": {
			const code = query.get("code")
			const state = query.get("state")
			const organizationId = query.get("organizationId")
			const providerModel = query.get("provider_model")

			if (!code) {
				break
			}

			await getCloudService().handleAuthCallback(
				code,
				state ?? "",
				organizationId === "null" ? undefined : (organizationId ?? undefined),
				providerModel ?? undefined,
			)
			break
		}
		default:
			break
	}
}
