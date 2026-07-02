import { ZodError } from "zod"

import {
	type TelemetryClient,
	type TelemetryPropertiesProvider,
	TelemetryEventName,
	type TelemetrySetting,
} from "@jabberwock/types"

export class TelemetryService {
	constructor(private clients: TelemetryClient[]) {}

	public register(client: TelemetryClient): void {
		this.clients.push(client)
	}

	public setProvider(provider: TelemetryPropertiesProvider): void {
		if (this.isReady) {
			this.clients.forEach((client) => client.setProvider(provider))
		}
	}

	private get isReady(): boolean {
		return this.clients.length > 0
	}

	public updateTelemetryState(isOptedIn: boolean): void {
		if (!this.isReady) {
			return
		}

		this.clients.forEach((client) => client.updateTelemetryState(isOptedIn))
	}

	public captureEvent(eventName: TelemetryEventName, properties?: Record<string, unknown>): void {
		if (!this.isReady) {
			return
		}

		this.clients.forEach((client) => client.capture({ event: eventName, properties }))
	}

	public captureException(error: Error, additionalProperties?: Record<string, unknown>): void {
		if (!this.isReady) {
			return
		}

		this.clients.forEach((client) => client.captureException(error, additionalProperties))
	}

	public captureTaskCreated(taskId: string): void {
		this.captureEvent(TelemetryEventName.TASK_CREATED, { taskId })
	}

	public captureTaskRestarted(taskId: string): void {
		this.captureEvent(TelemetryEventName.TASK_RESTARTED, { taskId })
	}

	public captureTaskCompleted(taskId: string): void {
		this.captureEvent(TelemetryEventName.TASK_COMPLETED, { taskId })
	}

	public captureConversationMessage(taskId: string, source: "user" | "assistant"): void {
		this.captureEvent(TelemetryEventName.TASK_CONVERSATION_MESSAGE, { taskId, source })
	}

	public captureLlmCompletion(
		taskId: string,
		properties: {
			inputTokens: number
			outputTokens: number
			cacheWriteTokens: number
			cacheReadTokens: number
			cost?: number
		},
	): void {
		this.captureEvent(TelemetryEventName.LLM_COMPLETION, { taskId, ...properties })
	}

	public captureModeSwitch(taskId: string, newMode: string): void {
		this.captureEvent(TelemetryEventName.MODE_SWITCH, { taskId, newMode })
	}

	public captureToolUsage(taskId: string, tool: string): void {
		this.captureEvent(TelemetryEventName.TOOL_USED, { taskId, tool })
	}

	public captureCheckpointCreated(taskId: string): void {
		this.captureEvent(TelemetryEventName.CHECKPOINT_CREATED, { taskId })
	}

	public captureCheckpointDiffed(taskId: string): void {
		this.captureEvent(TelemetryEventName.CHECKPOINT_DIFFED, { taskId })
	}

	public captureCheckpointRestored(taskId: string): void {
		this.captureEvent(TelemetryEventName.CHECKPOINT_RESTORED, { taskId })
	}

	public captureContextCondensed(taskId: string, isAutomaticTrigger: boolean, usedCustomPrompt?: boolean): void {
		this.captureEvent(TelemetryEventName.CONTEXT_CONDENSED, {
			taskId,
			isAutomaticTrigger,
			...(usedCustomPrompt !== undefined && { usedCustomPrompt }),
		})
	}

	public captureSlidingWindowTruncation(taskId: string): void {
		this.captureEvent(TelemetryEventName.SLIDING_WINDOW_TRUNCATION, { taskId })
	}

	public captureCodeActionUsed(actionType: string): void {
		this.captureEvent(TelemetryEventName.CODE_ACTION_USED, { actionType })
	}

	public capturePromptEnhanced(taskId?: string): void {
		this.captureEvent(TelemetryEventName.PROMPT_ENHANCED, { ...(taskId && { taskId }) })
	}

	public captureSchemaValidationError({ schemaName, error }: { schemaName: string; error: ZodError }): void {
		this.captureEvent(TelemetryEventName.SCHEMA_VALIDATION_ERROR, { schemaName, error: error.format() })
	}

	public captureDiffApplicationError(taskId: string, consecutiveMistakeCount: number): void {
		this.captureEvent(TelemetryEventName.DIFF_APPLICATION_ERROR, { taskId, consecutiveMistakeCount })
	}

	public captureShellIntegrationError(taskId: string): void {
		this.captureEvent(TelemetryEventName.SHELL_INTEGRATION_ERROR, { taskId })
	}

	public captureConsecutiveMistakeError(taskId: string): void {
		this.captureEvent(TelemetryEventName.CONSECUTIVE_MISTAKE_ERROR, { taskId })
	}

	public captureTabShown(tab: string): void {
		this.captureEvent(TelemetryEventName.TAB_SHOWN, { tab })
	}

	public captureModeSettingChanged(settingName: string): void {
		this.captureEvent(TelemetryEventName.MODE_SETTINGS_CHANGED, { settingName })
	}

	public captureCustomModeCreated(modeSlug: string, modeName: string): void {
		this.captureEvent(TelemetryEventName.CUSTOM_MODE_CREATED, { modeSlug, modeName })
	}

	public captureMarketplaceItemInstalled(
		itemId: string,
		itemType: string,
		itemName: string,
		target: string,
		properties?: Record<string, unknown>,
	): void {
		this.captureEvent(TelemetryEventName.MARKETPLACE_ITEM_INSTALLED, {
			itemId,
			itemType,
			itemName,
			target,
			...(properties || {}),
		})
	}

	public captureMarketplaceItemRemoved(itemId: string, itemType: string, itemName: string, target: string): void {
		this.captureEvent(TelemetryEventName.MARKETPLACE_ITEM_REMOVED, {
			itemId,
			itemType,
			itemName,
			target,
		})
	}

	public captureTitleButtonClicked(button: string): void {
		this.captureEvent(TelemetryEventName.TITLE_BUTTON_CLICKED, { button })
	}

	public captureTelemetrySettingsChanged(previousSetting: TelemetrySetting, newSetting: TelemetrySetting): void {
		this.captureEvent(TelemetryEventName.TELEMETRY_SETTINGS_CHANGED, {
			previousSetting,
			newSetting,
		})
	}

	public isTelemetryEnabled(): boolean {
		return this.isReady && this.clients.some((client) => client.isTelemetryEnabled())
	}

	public async shutdown(): Promise<void> {
		if (!this.isReady) {
			return
		}

		this.clients.forEach((client) => client.shutdown())
	}
}
