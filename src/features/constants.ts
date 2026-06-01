/**
 * Event Type Constants — namespaced access to the single source of truth.
 *
 * Usage:
 *   import { eventConstants } from "./constants"
 *   vscode.postMessage({ type: eventConstants.CHAT.TASK.NEW_TASK, text })
 *
 * Frontend imports directly from "@jabberwock/types".
 */
export { eventConstants } from "@jabberwock/types"
