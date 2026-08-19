import type { IntentHandlerContext as IntentBusCtx } from "@features/intents/context"
import { EventBridge } from "@features/foundation/webview/EventBridge"
import { getVscodeContext } from "@features/foundation/vscode/context"
import { getCodeIndexManager, getAllCodeIndexManagers } from "@services/code-index/manager/manager.factory"
import { t } from "@i18n"
import {
	sendNoWorkspaceResponse,
	startCodeIndexing,
	toggleWorkspaceIndexing,
	syncManagersAfterAutoEnable,
} from "./on-settings-code-index.helpers"

export async function handleRequestStatus(
	_intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) {
		return
	}

	const manager = getCodeIndexManager(getVscodeContext().extensionContext)
	if (!manager) {
		await sendNoWorkspaceResponse(provider)
		return
	}

	const status = manager.getCurrentStatus()
	provider.postMessageToWebview({
		type: "indexingStatusUpdate",
		values: status,
	})
}

export async function handleSecretStatus(
	_intent: { id: string; type: string; payload: unknown },
	ctx: IntentBusCtx,
): Promise<void> {
	const provider = ctx.provider
	if (!provider) {
		return
	}

	const secrets = provider.context.secrets
	const hasOpenAiKey = !!(await secrets.get("codeIndexOpenAiKey"))
	const hasQdrantApiKey = !!(await secrets.get("codeIndexQdrantApiKey"))
	const hasOpenAiCompatibleApiKey = !!(await secrets.get("codebaseIndexOpenAiCompatibleApiKey"))
	const hasGeminiApiKey = !!(await secrets.get("codebaseIndexGeminiApiKey"))
	const hasMistralApiKey = !!(await secrets.get("codebaseIndexMistralApiKey"))
	const hasVercelAiGatewayApiKey = !!(await secrets.get("codebaseIndexVercelAiGatewayApiKey"))
	const hasOpenRouterApiKey = !!(await secrets.get("codebaseIndexOpenRouterApiKey"))

	provider.postMessageToWebview({
		type: "codeIndexSecretStatus",
		values: {
			hasOpenAiKey,
			hasQdrantApiKey,
			hasOpenAiCompatibleApiKey,
			hasGeminiApiKey,
			hasMistralApiKey,
			hasVercelAiGatewayApiKey,
			hasOpenRouterApiKey,
		},
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
		EventBridge.outputChannel?.appendLine(
			`Error starting indexing: ${error instanceof Error ? error.message : String(error)}`,
		)
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
		const manager = getCodeIndexManager(getVscodeContext().extensionContext)
		if (!manager) {
			EventBridge.outputChannel?.appendLine("Cannot stop indexing: No workspace folder open")
			return
		}
		manager.stopIndexing()
		provider.postMessageToWebview({
			type: "indexingStatusUpdate",
			values: manager.getCurrentStatus(),
		})
	} catch (error) {
		EventBridge.outputChannel?.appendLine(
			`Error stopping indexing: ${error instanceof Error ? error.message : String(error)}`,
		)
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
		EventBridge.outputChannel?.appendLine(
			`Error toggling workspace indexing: ${error instanceof Error ? error.message : String(error)}`,
		)
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
		const manager = getCodeIndexManager(getVscodeContext().extensionContext)
		if (!manager) {
			EventBridge.outputChannel?.appendLine("Cannot set auto-enable default: No workspace folder open")
			return
		}

		const allManagers = getAllCodeIndexManagers()
		const priorStates = new Map(allManagers.map((m) => [m, m.isWorkspaceEnabled]))
		await manager.setAutoEnableDefault(payload.bool ?? true)

		await syncManagersAfterAutoEnable(allManagers, priorStates)

		provider.postMessageToWebview({
			type: "indexingStatusUpdate",
			values: manager.getCurrentStatus(),
		})
	} catch (error) {
		EventBridge.outputChannel?.appendLine(
			`Error setting auto-enable default: ${error instanceof Error ? error.message : String(error)}`,
		)
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
		const manager = getCodeIndexManager(getVscodeContext().extensionContext)
		if (!manager) {
			EventBridge.outputChannel?.appendLine("Cannot clear index data: No workspace folder open")
			provider.postMessageToWebview({
				type: "indexCleared",
				values: {
					success: false,
					error: t("embeddings:orchestrator.indexingRequiresWorkspace"),
				},
			})
			return
		}
		await manager.clearIndexData()
		provider.postMessageToWebview({ type: "indexCleared", values: { success: true } })
	} catch (error) {
		EventBridge.outputChannel?.appendLine(
			`Error clearing index data: ${error instanceof Error ? error.message : String(error)}`,
		)
		provider.postMessageToWebview({
			type: "indexCleared",
			values: {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			},
		})
	}
}
