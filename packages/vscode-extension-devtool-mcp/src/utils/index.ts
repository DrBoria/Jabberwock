/**
 * Shared, environment-agnostic utilities.
 *
 * - `rpc` — JSON-RPC helpers (pure)
 * - `log` — pure log formatting/filtering (shared by console + state tools)
 *
 * The message interceptor lives in `../mcp/interceptor/index.js`.
 * Config lives in `../mcp/config.js`, the CommandRegistry in
 * `../mcp/command-registry.js`; the WebSocket
 * client transport lives in `../mcp/transport/stdio.js`.
 */
export * from "./rpc.js"
export * from "./log.js"
