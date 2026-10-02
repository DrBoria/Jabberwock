import posthog from "posthog-js"

import type { TelemetrySetting } from "@jabberwock/types"

export interface TelemetryClient {
	/** Re-initialise (or disable) the posthog client for the given telemetry setting. */
	updateTelemetryState(telemetrySetting: TelemetrySetting, apiKey?: string, distinctId?: string): void
	/** Capture an event. No-op when telemetry is disabled. */
	capture(eventName: string, properties?: Record<string, unknown>): void
}

/**
 * Create a telemetry client wrapping posthog-js.
 *
 * Factory-closure form (no class): the enabled-flag lives in the closure, not
 * module state. The singleton below is the one shared instance.
 */
export function createTelemetryClient(): TelemetryClient {
	let telemetryEnabled = false

	return {
		updateTelemetryState(telemetrySetting: TelemetrySetting, apiKey?: string, distinctId?: string) {
			posthog.reset()

			if (telemetrySetting !== "disabled" && apiKey && distinctId) {
				telemetryEnabled = true

				posthog.init(apiKey, {
					api_host: "https://ph.jabberwock.com",
					ui_host: "https://us.posthog.com",
					persistence: "localStorage",
					loaded: () => posthog.identify(distinctId),
					capture_pageview: false,
					capture_pageleave: false,
					autocapture: false,
				})
			} else {
				telemetryEnabled = false
			}
		},

		capture(eventName: string, properties?: Record<string, unknown>) {
			if (telemetryEnabled) {
				try {
					posthog.capture(eventName, properties)
				} catch (_error) {
					// Silently fail if there's an error capturing an event.
				}
			}
		},
	}
}

export const telemetryClient = createTelemetryClient()
