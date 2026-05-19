import type { EventBridge } from "./EventBridge"
import type { WebviewMessage } from "@jabberwock/types"

/**
 * WebviewMessage augmented with a string index signature,
 * so both typed and untyped message objects are accepted.
 */
export type HandlerMessage = WebviewMessage & Record<string, unknown>
export type HandlerFn = (provider: EventBridge, message: HandlerMessage) => Promise<void>
