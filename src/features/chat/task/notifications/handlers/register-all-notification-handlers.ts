import type { IntentBus } from "@features/intents/bus"
import { registerOnAskResponseReceived } from "./ask/on-ask-response-received"
import { registerOnNotificationPersist } from "./notification/on-notification-persist"
import { registerOnNotificationAdd } from "./notification/on-notification-add"
import { registerOnAskNotification } from "./ask/on-ask-notification"
import { registerOnLogWrite } from "./on-log-write"
import { registerOnCheckpointDiffRequested } from "./checkpoint/on-checkpoint-diff-requested"
import { registerOnCheckpointRestoreRequested } from "./checkpoint/on-checkpoint-restore-requested"
import { registerOnTtsPlay } from "./tts/on-tts-play"
import { registerOnTtsStop } from "./tts/on-tts-stop"
import { registerOnTtsEnabledSet } from "./tts/on-tts-enabled-set"
import { registerOnTtsSpeedSet } from "./tts/on-tts-speed-set"
import { registerOnElicitationResponse } from "./ask/on-elicitation-response"
import { registerOnNotificationAskBroadcast } from "./notification/on-notification-ask-broadcast"

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
