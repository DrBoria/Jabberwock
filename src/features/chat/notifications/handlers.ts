import type { EventBridge } from "../../../core/webview/EventBridge"
import type { WebviewMessage, EditQueuedMessagePayload } from "@jabberwock/types"
import { playTts, setTtsEnabled, setTtsSpeed, stopTts } from "../../../utils/tts"
import { t } from "../../../i18n"
import * as vscode from "vscode"
import { checkoutDiffPayloadSchema, checkoutRestorePayloadSchema } from "@jabberwock/types"
import pWaitFor from "p-wait-for"

import { postStateToWebview } from "../../foundation/window-manager/store"
export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

export const handlerMap: Record<string, HandlerFn> = {
	checkpointDiff: async (provider, message) => {
		const result = checkoutDiffPayloadSchema.safeParse(message.payload)

		if (result.success) {
			await provider.getCurrentTask()?.checkpointDiff({
				ts: result.data.ts ?? Date.now(),
				mode: result.data.mode,
				commitHash: result.data.commitHash || "",
				previousCommitHash: result.data.previousCommitHash,
			})
		}
	},

	checkpointRestore: async (provider, message) => {
		const result = checkoutRestorePayloadSchema.safeParse(message.payload)

		if (result.success) {
			provider.getCurrentTask()?.abortTask?.()

			try {
				await pWaitFor(() => provider.getCurrentTask()?.isInitialized === true, { timeout: 3_000 })
			} catch (error) {
				vscode.window.showErrorMessage(t("common:errors.checkpoint_timeout"))
			}

			try {
				await provider.getCurrentTask()?.checkpointRestore({
					ts: result.data.ts || Date.now(),
					mode: result.data.mode,
					commitHash: result.data.commitHash,
				})
			} catch (error) {
				vscode.window.showErrorMessage(t("common:errors.checkpoint_failed"))
			}
		}
	},

	playTts: async (provider, message) => {
		if (message.text) {
			playTts(message.text, {
				onStart: () => provider.postMessageToWebview({ type: "ttsStart", text: message.text }),
				onStop: () => provider.postMessageToWebview({ type: "ttsStop", text: message.text }),
			})
		}
	},

	stopTts: async (_provider, _message) => {
		stopTts()
	},

	ttsEnabled: async (provider, message) => {
		const ttsEnabled = message.bool ?? true
		await provider.updateGlobalState("ttsEnabled", ttsEnabled)
		setTtsEnabled(ttsEnabled)
		await postStateToWebview(provider)
	},

	ttsSpeed: async (provider, message) => {
		const ttsSpeed = message.value ?? 1.0
		await provider.updateGlobalState("ttsSpeed", ttsSpeed)
		setTtsSpeed(ttsSpeed)
		await postStateToWebview(provider)
	},

	queueMessage: async (provider, message) => {
		const currentCline = provider.getCurrentTask()
		const cwd = currentCline?.cwd || provider.cwd
		// resolveIncomingImages inline
		const text = message.text ?? ""
		const images = message.images
		const currentTask = provider.getCurrentTask()
		const state = await provider.getState()
		const { resolveImageMentions } = await import("../../../core/mentions/resolveImageMentions")
		const resolved = await resolveImageMentions({
			text,
			images,
			cwd,
			jabberwockIgnoreController: currentTask?.jabberwockIgnoreController,
			maxImageFileSize: state.maxImageFileSize,
			maxTotalImageSize: state.maxTotalImageSize,
		})
		provider.getCurrentTask()?.messageQueueService.addMessage(resolved.text, resolved.images)
	},

	editQueuedMessage: async (provider, message) => {
		if (message.payload) {
			const { id, text, images } = message.payload as EditQueuedMessagePayload
			provider.getCurrentTask()?.messageQueueService.updateMessage(id, text, images)
		}
	},

	elicitationResponse: async (provider, message) => {
		if (message.values) {
			provider.getCurrentTask()?.resolveElicitation(message.values)
		}
	},

	playSound: async (_provider, _message) => {
		// No-op or future implementation
	},

	removeQueuedMessage: async (provider, message) => {
		provider.getCurrentTask()?.messageQueueService.removeMessage(message.text ?? "")
	},
}
