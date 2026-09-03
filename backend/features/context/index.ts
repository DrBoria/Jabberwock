/**
 * Infinite Context Graph Storage - backend context feature module barrel (ICG-C1).
 * Purity boundary (v4 G6 / LCM spec section 7.1): pure Node only - no host API imports anywhere in this tree; webview-reachable code must not import from here directly, the frontend consumes protocol types + events over IConnectorEventBus alone.
 */

export { ContextTaskMeta, ContextWindowModel, createContextWindowState } from "./store"
export type { IContextTaskMeta, IContextWindowModel } from "./store"
export * from "./services/ContextArchiveService"
