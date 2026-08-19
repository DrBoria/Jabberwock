import type { CoreIntents } from "./core/types.ts"
import type { SettingsIntents } from "./settings/types.ts"
import { IntentTypeCore } from "./core/constants.ts"
import { IntentTypeSettings } from "./settings/constants.ts"

/**
 * All intents — typed union of every possible intent in the system.
 *
 * Intents are REACTIVE entities dispatched by IntentBus. They live in
 * the MST IntentStore and are consumed by handlers registered in the
 * feature directories they belong to.
 *
 * No imperative pipeline — intents chain via the bus.
 */
export type AllIntents = CoreIntents | SettingsIntents

/**
 * String constants for each intent type — used for bus.register() and
 * store.createIntent() calls.
 */
export const IntentType = { ...IntentTypeCore, ...IntentTypeSettings } as const

/**
 * Lifecycle status of an intent in the store.
 */
export enum IntentStatus {
	Queued = "queued",
	Processing = "processing",
	Suspended = "suspended",
	Success = "success",
	Failed = "failed",
}

/**
 * An intent instance stored in the MST IntentStore.
 */
export interface Intent {
	id: string
	type: string
	payload: Record<string, unknown>
	status: IntentStatus
	createdAt: number
	traceId?: string
	parentId?: string
}
