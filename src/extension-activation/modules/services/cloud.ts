import * as vscode from "vscode"

import type { AuthState, CloudUserInfo } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"
import { createCloudService } from "@jabberwock/cloud"

import { EventBridge } from "@features/foundation/webview/EventBridge"
import { getVscodeContext } from "@features/foundation/vscode/context"
import { postStateToWebviewWithoutMessages } from "@features/foundation/window-manager/store"
import { flushModels, refreshModels } from "@api/providers/fetchers/modelCache"
import { getCloudService as getCloudServiceInstance } from "@jabberwock/cloud"
import { upsertProviderProfile } from "@features/settings/models/api-config-store.profiles"
import { initializeCloudProfileSyncWhenReady } from "@features/cloud/store"

let _authStateChangedHandler: ((data: { state: AuthState; previousState: AuthState }) => Promise<void>) | undefined
let _settingsUpdatedHandler: (() => void) | undefined
let _userInfoHandler: ((data: { userInfo: CloudUserInfo }) => Promise<void>) | undefined

export function getAuthStateChangedHandler(): typeof _authStateChangedHandler {
	return _authStateChangedHandler
}

export function getSettingsUpdatedHandler(): typeof _settingsUpdatedHandler {
	return _settingsUpdatedHandler
}

export function getUserInfoHandler(): typeof _userInfoHandler {
	return _userInfoHandler
}

export async function setupCloudService(
	context: vscode.ExtensionContext,
	cloudLogger: (...args: unknown[]) => void,
	provider: EventBridge,
	outputChannel: vscode.OutputChannel,
): Promise<Awaited<ReturnType<typeof createCloudService>>> {
	const postStateListener = async () => {
		const instance = await EventBridge.getVisibleInstance()
		if (instance) {
			postStateToWebviewWithoutMessages(instance)
		}
	}

	const authStateChangedHandler = async (data: { state: AuthState; previousState: AuthState }) => {
		postStateListener()

		const handleRooModelsCache = async () => {
			try {
				if (data.state === "active-session") {
					const sessionToken = getCloudServiceInstance()?.authService?.getSessionToken()
					if (sessionToken) {
						await refreshModels({
							provider: "jabberwock",
							baseUrl: process.env.JABBERWOCK_CODE_PROVIDER_URL ?? "https://api.jabberwock.com/proxy",
							apiKey: sessionToken,
						})
					}
				} else {
					await flushModels({ provider: "jabberwock" }, false)
				}
			} catch (error) {
				cloudLogger(
					`[authStateChangedHandler] Failed to handle Jabberwock models cache: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		if (data.state === "active-session" || data.state === "logged-out") {
			await handleRooModelsCache()

			if (data.state === "active-session") {
				try {
					const storedModel = context.globalState.get<string>("jabberwock-provider-model")
					if (storedModel) {
						cloudLogger(`[authStateChangedHandler] Applying stored provider model: ${storedModel}`)
						const currentConfigName =
							getVscodeContext().getGlobalState<string>("currentApiConfigName") || "default"
						await upsertProviderProfile(provider, currentConfigName, {
							apiProvider: "jabberwock",
							apiModelId: storedModel,
						})
						await context.globalState.update("jabberwock-provider-model", undefined)
						cloudLogger(`[authStateChangedHandler] Applied and cleared stored provider model`)
					}
				} catch (error) {
					cloudLogger(
						`[authStateChangedHandler] Failed to apply stored provider model: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
		}
	}

	const settingsUpdatedHandler = async () => {
		postStateListener()
	}

	const userInfoHandler = async ({ userInfo: _userInfo }: { userInfo: CloudUserInfo }) => {
		postStateListener()
	}

	_authStateChangedHandler = authStateChangedHandler
	_settingsUpdatedHandler = settingsUpdatedHandler
	_userInfoHandler = userInfoHandler

	const cloudService = await createCloudService(context, cloudLogger, {
		"auth-state-changed": authStateChangedHandler,
		"settings-updated": settingsUpdatedHandler,
		"user-info": userInfoHandler,
	})

	try {
		if (cloudService.telemetryClient) {
			getTelemetryService().register(cloudService.telemetryClient)
		}
	} catch (error) {
		outputChannel.appendLine(
			`[CloudService] Failed to register TelemetryClient: ${error instanceof Error ? error.message : String(error)}`,
		)
	}

	context.subscriptions.push(cloudService)

	try {
		await initializeCloudProfileSyncWhenReady(provider)
	} catch (error) {
		outputChannel.appendLine(
			`[CloudService] Failed to initialize cloud profile sync: ${error instanceof Error ? error.message : String(error)}`,
		)
	}

	return cloudService
}
