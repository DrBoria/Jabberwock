import type { IntentBus } from "../../../intents/bus"
import { onWebviewMessage } from "@features/foundation/webview/events/handlers/on-webview-message"
import { IntentStatus } from "@jabberwock/types"
import { getBackendRootStore } from "@features/storeSingleton"
import { registerOnCloud } from "../../handlers/on-cloud"
import {
	CLOUD_CLOUD_BUTTON_CLICKED,
	CLOUD_JABBERWOCK_CLOUD_SIGN_IN,
	CLOUD_CLOUD_LANDING_PAGE_SIGN_IN,
	CLOUD_JABBERWOCK_CLOUD_SIGN_OUT,
	CLOUD_JABBERWOCK_CLOUD_MANUAL_URL,
	CLOUD_OPEN_AI_CODEX_SIGN_IN,
	CLOUD_OPEN_AI_CODEX_SIGN_OUT,
	CLOUD_SWITCH_ORGANIZATION,
	CLOUD_CLEAR_CLOUD_AUTH_SKIP_MODEL,
} from "../constants"

/**
 * Register all cloud event handlers on the IntentBus.
 */
export function registerOnCloudIntents(bus: IntentBus): void {
	// ── Register bus handlers (existing cloud logic) ───────────────
	registerOnCloud(bus)

	// ── onWebviewMessage registrations to replace WEBVIEW_TO_INTENT fallback ──
	onWebviewMessage(CLOUD_CLOUD_BUTTON_CLICKED, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "cloud.button.clicked",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CLOUD_JABBERWOCK_CLOUD_SIGN_IN, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "cloud.sign.in",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CLOUD_CLOUD_LANDING_PAGE_SIGN_IN, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "cloud.landing.page.sign.in",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CLOUD_JABBERWOCK_CLOUD_SIGN_OUT, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "cloud.sign.out",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CLOUD_JABBERWOCK_CLOUD_MANUAL_URL, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "cloud.manual.url",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CLOUD_OPEN_AI_CODEX_SIGN_IN, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "cloud.openai.codex.sign.in",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CLOUD_OPEN_AI_CODEX_SIGN_OUT, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "cloud.openai.codex.sign.out",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CLOUD_SWITCH_ORGANIZATION, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "cloud.switch.organization",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})

	onWebviewMessage(CLOUD_CLEAR_CLOUD_AUTH_SKIP_MODEL, (_provider, message) => {
		const store = getBackendRootStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "cloud.clear.auth.skip.model",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}
