import crypto from "crypto"
import type { IIntentStore, IIntentPayload } from "../../intents/store"
import { IntentConstants } from "@intentConstants"
import { IntentStatus } from "@jabberwock/types"

/**
 * Create an intent to start an API request.
 * The IntentBus routes this to on-api-request-started handler.
 */
export function requestApi(intentStore: IIntentStore, payload?: IIntentPayload): void {
	intentStore.createIntent({
		id: crypto.randomUUID(),
		type: IntentConstants.api.STREAMING_STARTED,
		payload: payload ?? {},
		status: IntentStatus.Queued,
		createdAt: Date.now(),
	})
}
