/**
 * File-based debug logging utility
 *
 * This writes logs to ~/.jabberwock/cli-debug.log, avoiding stdout/stderr
 * which would break TUI applications. The log format is timestamped JSON.
 *
 * Usage:
 *   import { debugLog, DebugLogger } from "@jabberwock/core/cli"
 *
 *   // Simple logging
 *   debugLog("handleModeSwitch", { mode: newMode, configId })
 *
 *   // Or create a named logger for a component
 *   const log = new DebugLogger("EventBridge")
 *   log.info("handleModeSwitch", { mode: newMode })
 */

export { setDebugLogEnabled, debugLog } from "./utils.ts"
export { DebugLogger, providerDebugLog } from "./logger.ts"
