/**
 * Say-action barrel — the single shared broadcast utility.
 *
 * `emitBroadcast(domain, taskId, …)` is the one entry point for adding a
 * message to the task's message feed. The `domain` argument selects the
 * broadcast intent (`"agent"`, `"system"`, `"mcp"`, `"user"`), which
 * `on-message-broadcast.ts` handles to add the notification to the MST store
 * and push the snapshot to the webview.
 *
 * The former per-domain creators (agentBroadcast / systemBroadcast /
 * mcpBroadcast / userBroadcast) were thin passthroughs that only chose the
 * intent — they have been consolidated into this one utility.
 */
export { emitBroadcast } from "./emitBroadcast"
export type { BroadcastDomain, CheckpointData } from "./emitBroadcast"
