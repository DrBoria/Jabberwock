/**
 * Type declaration for the flat hydration-state builder (`backend/features/hydration.ts`).
 *
 * This connector package resolves `@features/hydration` to this declaration so its own
 * `tsc --noEmit` stays isolated from the backend source graph. The runtime/server bundle
 * resolves the SAME specifier to the real implementation via `backend/tsconfig.json`
 * aliases, so there is exactly one code path at runtime. Keep this declaration in sync
 * with the signature exported by `backend/features/hydration.ts`.
 */

/**
 * Flat `ExtensionState`-shaped payload for the WS hello→state handshake (BUG-5).
 *
 * Unlike `getBackendRootSnapshot()` (raw NESTED MST root snapshot), this returns the shape
 * the frontend `store.mergeExtensionState(state)` applies: provider config, api config meta,
 * task history, and the active task's messages.
 */
export declare function buildHydrationState(): Record<string, unknown>
