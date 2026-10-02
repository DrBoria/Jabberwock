/**
 * Settings event-action creators — public API.
 *
 * Global (provider-less) creators live in sendSettingsGlobal.ts; the
 * provider-scoped creators are split across sendSettingsProviderEventsA/B/C.ts
 * to stay within the per-file line budget.
 */

export * from "./sendSettingsGlobal"
export * from "./sendSettingsProviderEventsA"
export * from "./sendSettingsProviderEventsB"
export * from "./sendSettingsProviderEventsC"
