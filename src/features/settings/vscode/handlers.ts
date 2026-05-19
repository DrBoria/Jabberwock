import * as vscode from "vscode"
import type { EventBridge } from "../../../core/webview/EventBridge"
import type { WebviewMessage } from "@jabberwock/types"

type MessagePayload = WebviewMessage & { [key: string]: unknown }

export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

const ALLOWED_VSCODE_SETTINGS = new Set(["terminal.integrated.inheritEnv"])

export const handlerMap: Record<string, HandlerFn> = {
	updateVSCodeSetting: async (provider, message) => {
		const msg = message as MessagePayload
		const setting = msg.setting as string | undefined
		const value = msg.value

		if (setting !== undefined && value !== undefined) {
			if (ALLOWED_VSCODE_SETTINGS.has(setting)) {
				await vscode.workspace.getConfiguration().update(setting, value, true)
			} else {
				vscode.window.showErrorMessage(`Cannot update restricted VSCode setting: ${setting}`)
			}
		}
	},

	getVSCodeSetting: async (provider, message) => {
		const msg = message as MessagePayload
		const setting = msg.setting as string | undefined

		if (setting) {
			try {
				await provider.postMessageToWebview({
					type: "vsCodeSetting",
					setting,
					value: vscode.workspace.getConfiguration().get(setting),
				})
			} catch (error: unknown) {
				const errorMsg = error instanceof Error ? error.message : String(error)
				console.error(`Failed to get VSCode setting ${(message as MessagePayload).setting}:`, error)

				await provider.postMessageToWebview({
					type: "vsCodeSetting",
					setting,
					error: `Failed to get setting: ${errorMsg}`,
					value: undefined,
				})
			}
		}
	},

	autoApprovalEnabled: async (provider, message) => {
		const bool = message.bool ?? false
		await provider.updateGlobalState("autoApprovalEnabled", bool)
	},

	debugSetting: async (provider, message) => {
		const bool = message.bool ?? false
		await (provider.contextProxy as { setValue: (key: string, value: unknown) => void }).setValue(
			"debugSetting",
			bool,
		)
	},
}
