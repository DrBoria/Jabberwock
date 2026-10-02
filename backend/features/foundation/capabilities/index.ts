/**
 * Barrel for the `foundation/capabilities` feature (S5 no-deep / no-shadow-store debt).
 *
 * Re-exports the process-wide capability registry (`registry.ts`) and the module-level
 * backend-logger slot (`backend-logger.ts`) so consumers import `@features/foundation/capabilities`
 * instead of deep module paths. Other capability modules (`notifications`, `pubsub`,
 * `bootstrap`, `in-memory-queue`) stay deep-imported until their own slices convert them.
 */

export * from "./backend-logger"
export * from "./registry"
export * from "./notifications"
