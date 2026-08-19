import {
	type AuthService,
	type Notification,
	type SettingsService,
	type TelemetryEvent,
	TelemetryEventName,
	jabberwockTelemetryEventSchema,
} from "@jabberwock/types"

import type { RetryQueue } from "../retry-queue/index.ts"
import { backfillMessages as backfillMessagesHelper } from "./backfill-telemetry-messages.ts"
import { BaseTelemetryClient } from "./BaseTelemetryClient.ts"
import { fetchTelemetry } from "./fetch-telemetry.ts"

export class CloudTelemetryClient extends BaseTelemetryClient {
	private retryQueue: RetryQueue | null = null

	constructor(
		private authService: AuthService,
		private settingsService: SettingsService,
		retryQueue?: RetryQueue,
	) {
		super({
			type: "exclude",
			events: [TelemetryEventName.TASK_CONVERSATION_MESSAGE],
		})
		this.retryQueue = retryQueue || null
	}

	public override async capture(event: TelemetryEvent) {
		if (!this.isTelemetryEnabled() || !this.isEventCapturable(event.event)) {
			if (this.debug) {
				console.info(`[TelemetryClient#capture] Skipping event: ${event.event}`)
			}

			return
		}

		const payload = {
			type: event.event,
			properties: await this.getEventProperties(event),
		}

		if (this.debug) {
			console.info(`[TelemetryClient#capture] ${JSON.stringify(payload)}`)
		}

		const result = jabberwockTelemetryEventSchema.safeParse(payload)

		if (!result.success) {
			console.error(
				`[TelemetryClient#capture] Invalid telemetry event: ${result.error.message} - ${JSON.stringify(payload)}`,
			)

			return
		}

		try {
			await fetchTelemetry(
				`events`,
				{
					method: "POST",
					body: JSON.stringify(result.data),
				},
				{ authService: this.authService, retryQueue: this.retryQueue },
			)
		} catch (error) {
			console.error(`[TelemetryClient#capture] Error sending telemetry event: ${error}`)
		}
	}

	public async backfillMessages(messages: Notification[], taskId: string): Promise<void> {
		if (!this.isTelemetryEnabled()) {
			return
		}

		const getEventProperties = async (event: { event: string; properties: Record<string, unknown> }) => {
			return (
				(await this.getEventProperties(event as unknown as TelemetryEvent)) ?? ({} as Record<string, unknown>)
			)
		}

		const validMessages = messages.filter((m) => m.text !== undefined).map((m) => ({ text: m.text!, ts: m.ts }))
		await backfillMessagesHelper(validMessages, taskId, {
			authService: this.authService,
			settingsService: this.settingsService,
			getEventProperties,
			debug: this.debug,
		})
	}

	public override updateTelemetryState(_didUserOptIn: boolean) {}

	public override isTelemetryEnabled(): boolean {
		if (process.env.JABBERWOCK_CODE_DISABLE_TELEMETRY === "1") {
			return false
		}

		return true
	}

	protected override isEventCapturable(eventName: TelemetryEventName): boolean {
		if (!super.isEventCapturable(eventName)) {
			return false
		}

		if (eventName === TelemetryEventName.TASK_MESSAGE) {
			return this.settingsService.isTaskSyncEnabled()
		}

		return true
	}

	public override async shutdown() {}
}
