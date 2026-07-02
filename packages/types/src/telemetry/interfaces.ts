import { TelemetryEventName } from "./event-names.ts"
import { TelemetryEvent, TelemetryProperties } from "./properties.ts"

export type TelemetryEventSubscription =
	| { type: "include"; events: TelemetryEventName[] }
	| { type: "exclude"; events: TelemetryEventName[] }

export interface TelemetryPropertiesProvider {
	getTelemetryProperties(): Promise<TelemetryProperties>
}

export interface TelemetryClient {
	subscription?: TelemetryEventSubscription

	setProvider(provider: TelemetryPropertiesProvider): void
	capture(options: TelemetryEvent): Promise<void>
	captureException(error: Error, additionalProperties?: Record<string, unknown>): Promise<void>
	updateTelemetryState(isOptedIn: boolean): void
	isTelemetryEnabled(): boolean
	shutdown(): Promise<void>
}
