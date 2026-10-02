/**
 * `foundation/webview` feature barrel.
 *
 * S5 shadow-store: `providerRegistry.ts` state moved into a `const` holder
 * object; this barrel is the sanctioned import surface for the registry
 * accessors. `EventBridge` / `inbound-wiring` / `events/*` stay deep for now
 * (separate slices).
 */
export * from "./providerRegistry"
export type { ProviderHandle } from "./EventBridge"
