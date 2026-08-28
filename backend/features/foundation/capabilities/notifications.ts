import type { NotificationErrorPayload } from "./pubsub"
import { getBackendCapabilities } from "./registry"

/** Topic name for the transport-agnostic error-notification stream (plan §2.3 L12). */
export const NOTIFICATION_ERROR_TOPIC = "notification.error" as const

/**
 * Publish a transport-agnostic error notification (plan §2.3 L12). The active host sink renders it —
 * in extension mode B2/B3 that is the native `vscode.window.showErrorMessage` toast wired at activation;
 * server mode fans the same topic out over WS frames (§6.3). Callers never touch a host API for this.
 */
export function publishNotificationError(message: string, details?: unknown): void {
	const payload: NotificationErrorPayload = details === undefined ? { message } : { message, details }
	try {
		getBackendCapabilities().pubsub.publish(NOTIFICATION_ERROR_TOPIC, payload)
	} catch (error) {
		console.error("[capabilities] Failed to publish notification.error:", error)
	}
}
