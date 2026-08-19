import {
	type TelemetryClient,
	type TelemetryEvent,
	TelemetryEventName,
	type TelemetryPropertiesProvider,
	type TelemetryEventSubscription,
} from "@jabberwock/types"

export abstract class BaseTelemetryClient implements TelemetryClient {
	protected providerRef: WeakRef<TelemetryPropertiesProvider> | null = null
	protected telemetryEnabled: boolean = false

	constructor(
		public readonly subscription?: TelemetryEventSubscription,
		protected readonly debug = false,
	) {}

	protected isEventCapturable(eventName: TelemetryEventName): boolean {
		if (!this.subscription) {
			return true
		}

		return this.subscription.type === "include"
			? this.subscription.events.includes(eventName)
			: !this.subscription.events.includes(eventName)
	}

	protected isPropertyCapturable(_propertyName: string): boolean {
		return true
	}

	protected async getEventProperties(event: TelemetryEvent): Promise<TelemetryEvent["properties"]> {
		let providerProperties: TelemetryEvent["properties"] = {}
		const provider = this.providerRef?.deref()

		if (provider) {
			try {
				providerProperties = await provider.getTelemetryProperties()
			} catch (error) {
				console.error(
					`Error getting telemetry properties: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		const mergedProperties = { ...providerProperties, ...(event.properties || {}) }

		return Object.fromEntries(Object.entries(mergedProperties).filter(([key]) => this.isPropertyCapturable(key)))
	}

	public abstract capture(event: TelemetryEvent): Promise<void>

	public async captureException(_error: Error, _additionalProperties?: Record<string, unknown>): Promise<void> {}

	public setProvider(provider: TelemetryPropertiesProvider): void {
		this.providerRef = new WeakRef(provider)
	}

	public abstract updateTelemetryState(didUserOptIn: boolean): void

	public isTelemetryEnabled(): boolean {
		return this.telemetryEnabled
	}

	public abstract shutdown(): Promise<void>
}
