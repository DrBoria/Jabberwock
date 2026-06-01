import type { IntentBus } from "../../../../intents/bus"
import { registerOnAskResponseReceived } from "./on-ask-response-received"
import { registerOnNotificationPersist } from "./on-notification-persist"
import { registerOnNotificationAdd } from "./on-notification-add"
import { registerOnAskNotification } from "./on-ask-notification"
import { registerOnLogWrite } from "./on-log-write"

/**
 * Register all notification-related intent handlers on the bus.
 */
import { registerOnCheckpointDiffRequested } from "./on-checkpoint-diff-requested"
import { registerOnCheckpointRestoreRequested } from "./on-checkpoint-restore-requested"
import { registerOnTtsPlay } from "./on-tts-play"
import { registerOnTtsStop } from "./on-tts-stop"
import { registerOnTtsEnabledSet } from "./on-tts-enabled-set"
import { registerOnTtsSpeedSet } from "./on-tts-speed-set"
import { registerOnElicitationResponse } from "./on-elicitation-response"

import { registerOnNotificationAskBroadcast } from "./on-notification-ask-broadcast"

export function registerAllNotificationHandlers(bus: IntentBus): void {
	registerOnAskResponseReceived(bus)
	registerOnNotificationPersist(bus)
	registerOnNotificationAdd(bus)
	registerOnAskNotification(bus)
	registerOnLogWrite(bus)
	registerOnCheckpointDiffRequested(bus)
	registerOnCheckpointRestoreRequested(bus)
	registerOnTtsPlay(bus)
	registerOnTtsStop(bus)
	registerOnTtsEnabledSet(bus)
	registerOnTtsSpeedSet(bus)
	registerOnElicitationResponse(bus)
	registerOnNotificationAskBroadcast(bus)
}
