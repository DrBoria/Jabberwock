import posthog from "posthog-js"

import type { TelemetrySetting } from "@jabberwock/types"

class TelemetryClient {
	private telemetryEnabled: boolean = false

	public updateTelemetryState(telemetrySetting: TelemetrySetting, apiKey?: string, distinctId?: string) {
		posthog.reset()

		if (telemetrySetting !== "disabled" && apiKey && distinctId) {
			this.telemetryEnabled = true

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
			this.telemetryEnabled = false
		}
	}

	public capture(eventName: string, properties?: Record<string, unknown>) {
		if (this.telemetryEnabled) {
			try {
				posthog.capture(eventName, properties)
			} catch (_error) {
				// Silently fail if there's an error capturing an event.
			}
		}
	}
}

export const telemetryClient = new TelemetryClient()
