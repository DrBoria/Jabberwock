import type { EventBridge } from "../../../core/webview/EventBridge"
import type { ProviderSettings, WebviewMessage, ExtensionMessage } from "@jabberwock/types"
import { selectImages } from "../../../integrations/misc/process-images"
import { searchWorkspaceFiles } from "../../../services/search/file-search"
import { JabberwockIgnoreController } from "../../../core/ignore/JabberwockIgnoreController"
import { MessageEnhancer } from "../../../core/webview/messageEnhancer"
import { t } from "../../../i18n"
import * as vscode from "vscode"

export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

export const handlerMap: Record<string, HandlerFn> = {
	enhancePrompt: async (provider, message) => {
		if (message.text) {
			try {
				const state = (await provider.getState()) as Record<string, unknown>

				const {
					apiConfiguration,
					customSupportPrompts,
					listApiConfigMeta = [],
					enhancementApiConfigId,
					includeTaskHistoryInEnhance,
				} = state

				const currentCline = provider.getCurrentTask()

				const result = await MessageEnhancer.enhanceMessage({
					text: message.text,
					apiConfiguration: apiConfiguration as ProviderSettings,
					customSupportPrompts: customSupportPrompts as Record<string, unknown> | undefined,
					listApiConfigMeta: ((listApiConfigMeta || []) as Array<{ id?: string; name: string }>).map((m) => ({
						id: m.id || "default",
						name: m.name,
					})),
					enhancementApiConfigId: enhancementApiConfigId as string | undefined,
					includeTaskHistoryInEnhance: includeTaskHistoryInEnhance as boolean,
					currentClineMessages: currentCline?.clineMessages,
					providerSettingsManager: provider.providerSettingsManager!,
				})

				if (result.success && result.enhancedText) {
					MessageEnhancer.captureTelemetry(currentCline?.taskId, includeTaskHistoryInEnhance as boolean)
					await provider.postMessageToWebview({ type: "enhancedPrompt", text: result.enhancedText })
				} else {
					throw new Error(result.error || "Unknown error")
				}
			} catch (error) {
				provider.log(`Error enhancing prompt: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)

				vscode.window.showErrorMessage(t("common:errors.enhance_prompt"))
				await provider.postMessageToWebview({ type: "enhancedPrompt" })
			}
		}
	},

	selectImages: async (provider, message) => {
		const images = await selectImages()
		await provider.postMessageToWebview({
			type: "selectedImages",
			images,
			context: message.context,
			messageTs: message.messageTs,
		})
	},

	searchFiles: async (provider, message) => {
		const currentCline = provider.getCurrentTask()
		const workspacePath = currentCline?.cwd || provider.cwd

		if (!workspacePath) {
			await provider.postMessageToWebview({
				type: "fileSearchResults",
				results: [],
				requestId: message.requestId,
				error: "No workspace path available",
			})
			return
		}
		try {
			const results = await searchWorkspaceFiles(message.query || "", workspacePath, 20)

			const currentTask = provider.getCurrentTask()
			let jabberwockIgnoreController = currentTask?.jabberwockIgnoreController
			let tempController: JabberwockIgnoreController | undefined

			if (!jabberwockIgnoreController) {
				tempController = new JabberwockIgnoreController(workspacePath)
				await tempController.initialize()
				jabberwockIgnoreController = tempController
			}

			try {
				const { showJabberwockIgnoredFiles = false } = (await provider.getState()) ?? {}

				let filteredResults = results
				if (!showJabberwockIgnoredFiles && jabberwockIgnoreController) {
					const allowedPaths = jabberwockIgnoreController.filterPaths(results.map((r) => r.path))
					filteredResults = results.filter((r) => allowedPaths.includes(r.path))
				}

				await provider.postMessageToWebview({
					type: "fileSearchResults",
					results: filteredResults,
					requestId: message.requestId,
				})
			} finally {
				tempController?.dispose()
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			await provider.postMessageToWebview({
				type: "fileSearchResults",
				results: [],
				error: errorMessage,
				requestId: message.requestId,
			})
		}
	},

	draggedImages: async (provider, message) => {
		// Forward dragged images to the webview
		if (message.images) {
			await provider.postMessageToWebview({
				type: "draggedImages" as const,
				images: message.images,
			})
		}
	},
}
