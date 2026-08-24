/**
 * Say-action barrel — 4 domain-specific broadcast action creators.
 *
 * These replace the monolithic `say()` function with typed action creators
 * that emit the appropriate intent type for each message domain:
 *
 * - `agentBroadcast` — Assistant/agent responses (type: "agent")
 * - `systemBroadcast` — System events and status (type: "system")
 * - `mcpBroadcast` — MCP tool calls and responses (type: "mcp_tool")
 * - `userBroadcast` — User-originated content (type: "user")
 *
 * Each creates an Intent which is handled by `on-message-broadcast.ts`
 * to add the notification to the MST store and push the snapshot.
 */
export { agentBroadcast } from "./agentBroadcast"
export { systemBroadcast } from "./systemBroadcast"
export { mcpBroadcast } from "./mcpBroadcast"
export { userBroadcast } from "./userBroadcast"
