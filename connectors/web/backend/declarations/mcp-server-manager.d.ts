/**
 * Type declaration for the shared backend MCP server manager
 * (`backend/services/mcp/core/McpServerManager.ts`).
 *
 * This connector package resolves `@services/mcp/core/McpServerManager` to this
 * declaration so its own `tsc --noEmit` stays isolated from "the" backend source graph
 * (which is still partially vscode-coupled). The runtime/server bundle resolves the SAME
 * specifier to the real implementation via `backend/tsconfig.json` aliases, so there is
 * exactly one code path at runtime. Keep this declaration in sync with the real
 * `createMcpServerManager` / `McpServerManager` surface the server entrypoint uses.
 */

/** Singleton manager for MCP server instances (structural — the server entrypoint only constructs it). */
export declare class McpServerManager {}

/** Create (or reuse) the process-wide MCP server manager singleton. */
export declare function createMcpServerManager(): McpServerManager
