import type { IntentHandlerContext as IntentBusCtx } from "@features/intents"
import { log as backendLog } from "@features/foundation"
import { getBackendCapabilities } from "@features/foundation"
import { getHostEnvironment } from "@features/foundation"
import { getCodeIndexManager, getAllCodeIndexManagers } from "@services/code-index/manager/factory"
import { t } from "@i18n"
import {
	sendNoWorkspaceResponse,
	startCodeIndexing,
	toggleWorkspaceIndexing,
	syncManagersAfterAutoEnable,
} from "./helpers"
import { sendCodeIndexSecretStatus, sendIndexCleared, sendIndexingStatusUpdate } from "@features/settings"

export async function handleRequestStatus(
	_intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) {
		return
	}

	const manager = getCodeIndexManager(getHostEnvironment().extensionContext)
	if (!manager) {
		await sendNoWorkspaceResponse(provider)
		return
	}

	const status = manager.getCurrentStatus()
	sendIndexingStatusUpdate(provider, status)
}

export async function handleSecretStatus(
	_intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) {
		return
	}

	// v4 B3: secrets now live on the injected hostContext capability (§4.3) instead of provider.context.
	const secrets = getBackendCapabilities().hostContext.secrets
	const hasOpenAiKey = !!(await secrets?.get("codeIndexOpenAiKey"))
	const hasQdrantApiKey = !!(await secrets?.get("codeIndexQdrantApiKey"))
	const hasOpenAiCompatibleApiKey = !!(await secrets?.get("codebaseIndexOpenAiCompatibleApiKey"))
	const hasGeminiApiKey = !!(await secrets?.get("codebaseIndexGeminiApiKey"))
	const hasMistralApiKey = !!(await secrets?.get("codebaseIndexMistralApiKey"))
	const hasVercelAiGatewayApiKey = !!(await secrets?.get("codebaseIndexVercelAiGatewayApiKey"))
	const hasOpenRouterApiKey = !!(await secrets?.get("codebaseIndexOpenRouterApiKey"))

	sendCodeIndexSecretStatus(provider, {
		hasOpenAiKey,
		hasQdrantApiKey,
		hasOpenAiCompatibleApiKey,
		hasGeminiApiKey,
		hasMistralApiKey,
		hasVercelAiGatewayApiKey,
		hasOpenRouterApiKey,
	})
}

export async function handleStartIndexing(
	_intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) {
		return
	}

	try {
		await startCodeIndexing(provider)
	} catch (error) {
		backendLog.info(`Error starting indexing: ${error instanceof Error ? error.message : String(error)}`)
	}
}

export async function handleStopIndexing(
	_intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) {
		return
	}

	try {
		const manager = getCodeIndexManager(getHostEnvironment().extensionContext)
		if (!manager) {
			backendLog.info("Cannot stop indexing: No workspace folder open")
			return
		}
		manager.stopIndexing()
		sendIndexingStatusUpdate(provider, manager.getCurrentStatus())
	} catch (error) {
		backendLog.info(`Error stopping indexing: ${error instanceof Error ? error.message : String(error)}`)
	}
}

export async function handleToggleWorkspaceIndexing(
	intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) {
		return
	}

	const payload = intent.payload as { bool: boolean }

	try {
		await toggleWorkspaceIndexing(provider, payload.bool)
	} catch (error) {
		backendLog.info(`Error toggling workspace indexing: ${error instanceof Error ? error.message : String(error)}`)
	}
}

export async function handleAutoEnableDefault(
	intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) {
		return
	}

	const payload = intent.payload as { bool: boolean }

	try {
		const manager = getCodeIndexManager(getHostEnvironment().extensionContext)
		if (!manager) {
			backendLog.info("Cannot set auto-enable default: No workspace folder open")
			return
		}

		const allManagers = getAllCodeIndexManagers()
		const priorStates = new Map(allManagers.map((m) => [m, m.isWorkspaceEnabled]))
		await manager.setAutoEnableDefault(payload.bool ?? true)

		await syncManagersAfterAutoEnable(allManagers, priorStates)

		sendIndexingStatusUpdate(provider, manager.getCurrentStatus())
	} catch (error) {
		backendLog.info(`Error setting auto-enable default: ${error instanceof Error ? error.message : String(error)}`)
	}
}

export async function handleClearIndexData(
	_intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) {
		return
	}

	try {
		const manager = getCodeIndexManager(getHostEnvironment().extensionContext)
		if (!manager) {
			backendLog.info("Cannot clear index data: No workspace folder open")
			sendIndexCleared(provider, {
				success: false,
				error: t("embeddings:orchestrator.indexingRequiresWorkspace"),
			})
			return
		}
		await manager.clearIndexData()
		sendIndexCleared(provider, { success: true })
	} catch (error) {
		backendLog.info(`Error clearing index data: ${error instanceof Error ? error.message : String(error)}`)
		sendIndexCleared(provider, {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		})
	}
}
