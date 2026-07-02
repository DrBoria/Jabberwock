import delay from "delay"

import type { ITaskModel } from "@features/chat/task/store"
import { formatResponse } from "@features/settings/context/responses"
import { defaultModeSlug, getModeBySlug } from "@shared/modes"
import { BaseTool, ToolCallbacks } from "@features/chat/tools/a-b/BaseTool"
import type { ToolUse } from "@shared/tools"
import { getBackendRootStore } from "@features/storeSingleton"
import { getProvider } from "@features/foundation/webview/providerRegistry"

interface SwitchModeParams {
	mode_slug: string
	reason: string
}

export class SwitchModeTool extends BaseTool<"switch_mode"> {
	readonly name = "switch_mode" as const

	async execute(params: SwitchModeParams, task: ITaskModel, callbacks: ToolCallbacks): Promise<void> {
		const { mode_slug, reason } = params
		const { askApproval, handleError, pushToolResult } = callbacks

		try {
			if (!mode_slug) {
				task._state.setConsecutiveMistakeCount(task._state.consecutiveMistakeCount + 1)
				task.recordToolError("switch_mode")
				pushToolResult(await sayAndCreateMissingParamError(task.taskId, "switch_mode", "mode_slug"))
				return
			}

			task._state.setConsecutiveMistakeCount(0)

			// Verify the mode exists
			const customModes = getBackendRootStore().settings.modes.customModes
			const targetMode = getModeBySlug(mode_slug, customModes)

			if (!targetMode) {
				task.recordToolError("switch_mode")
				task._state.setDidToolFailInCurrentTurn(true)
				pushToolResult(formatResponse.toolError(`Invalid mode: ${mode_slug}`))
				return
			}

			// Check if already in requested mode
			const currentMode = task.taskMode ?? defaultModeSlug

			if (currentMode === mode_slug) {
				task.recordToolError("switch_mode")
				task._state.setDidToolFailInCurrentTurn(true)
				pushToolResult(`Already in ${targetMode.name} mode.`)
				return
			}

			// DEBUG: Log switch_mode request
			console.log(
				`[DEBUG:SwitchModeTool] taskId=${task.taskId} currentMode="${currentMode}" → switch to "${mode_slug}" reason="${reason}"`,
			)

			const completeMessage = JSON.stringify({ tool: "switchMode", mode: mode_slug, reason })
			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			// Switch the mode using shared handler
			await handleModeSwitch(getProvider(), mode_slug)

			pushToolResult(
				`Successfully switched from ${getModeBySlug(currentMode)?.name ?? currentMode} mode to ${
					targetMode.name
				} mode${reason ? ` because: ${reason}` : ""}.`,
			)

			await delay(500) // Delay to allow mode change to take effect before next tool is executed
		} catch (error) {
			await handleError("switching mode", error as Error)
		}
	}

	override async handlePartial(task: ITaskModel, block: ToolUse<"switch_mode">): Promise<void> {
		const mode_slug: string | undefined = block.params.mode_slug
		const reason: string | undefined = block.params.reason

		const partialMessage = JSON.stringify({
			tool: "switchMode",
			mode: mode_slug ?? "",
			reason: reason ?? "",
		})

		await ask(task.taskId, "tool", partialMessage, block.partial).catch(() => {})
	}
}

import { handleModeSwitch } from "@features/foundation/window-manager/store"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { sayAndCreateMissingParamError } from "@features/chat/task/messages/actions/command/sayAndCreateMissingParamError"

export const switchModeTool = new SwitchModeTool()
