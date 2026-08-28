import type { IntentHandlerContext as IntentBusCtx } from "@features/intents/context"
import type { CodebaseIndexConfig, CodebaseIndexProvider } from "@jabberwock/types"
import { log as backendLog } from "@features/foundation/capabilities/backend-logger"
import { getVscodeContext } from "@features/foundation/vscode/context"
import { postStateToWebview } from "@features/foundation/window-manager/store"
import { getCodeIndexManager } from "@services/code-index/manager/manager.factory"
import {
	getGlobalState,
	updateGlobalState,
	buildCodeIndexConfig,
	saveCodeIndexSecrets,
	handleManagerAfterSettingsSave,
	sendNoWorkspaceResponse,
} from "./on-settings-code-index.helpers"

export async function handleSaveSettings(
	intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) {
		return
	}

	const payload = intent.payload as {
		codeIndexSettings: (Partial<CodebaseIndexConfig> & Partial<CodebaseIndexProvider>) | undefined
	}

	if (!payload.codeIndexSettings) {
		return
	}

	const settings = payload.codeIndexSettings

	try {
		const currentConfig = (await getGlobalState("codebaseIndexConfig")) || ({} as CodebaseIndexConfig)
		const embedderProviderChanged =
			currentConfig.codebaseIndexEmbedderProvider !== settings.codebaseIndexEmbedderProvider
		const globalStateConfig = buildCodeIndexConfig(currentConfig, settings)

		await updateGlobalState(
			"codebaseIndexConfig",
			globalStateConfig as import("@jabberwock/types").GlobalState["codebaseIndexConfig"],
		)

		await saveCodeIndexSecrets(settings)

		await provider.postMessageToWebview({
			type: "codeIndexSettingsSaved",
			success: true,
			settings: globalStateConfig,
		})

		await postStateToWebview(provider)

		const currentCodeIndexManager = getCodeIndexManager(getVscodeContext().extensionContext)

		if (currentCodeIndexManager) {
			await handleManagerAfterSettingsSave(provider, currentCodeIndexManager, embedderProviderChanged)
		} else {
			backendLog.info("Cannot save code index settings: No workspace folder open")
			await sendNoWorkspaceResponse(provider)
		}
	} catch (error) {
		const errMsg = error instanceof Error ? error.message : String(error)
		backendLog.info(`Error saving code index settings: ${errMsg}`)
		await provider.postMessageToWebview({
			type: "codeIndexSettingsSaved",
			success: false,
			error: errMsg,
		})
	}
}
