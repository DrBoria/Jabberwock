/**
 * Type declaration for the backend root-store singleton (`backend/features/storeSingleton.ts`).
 *
 * This connector package resolves `@features/storeSingleton` to this declaration so its own
 * `tsc --noEmit` stays isolated from the backend source graph (which is still partially
 * vscode-coupled). The runtime/server bundle resolves the SAME specifier to the real
 * implementation via `backend/tsconfig.json` aliases, so there is exactly one code path at
 * runtime. Keep this declaration in sync with the signatures exported by
 * `backend/features/storeSingleton.ts`.
 *
 * The real `getBackendRootStore()` returns the full MST `IBackendRootStore`
 * (`backend/features/backendroot/store.ts`); this declaration exposes only the surface the
 * server entrypoint's `buildServerState()` needs (reading the full snapshot for the
 * hello->state handshake).
 */

/** Minimal structural surface of the MST root store: the full snapshot for the handshake payload. */
export declare function getBackendRootStore(): { getSnapshot(): unknown }

/** Full plain-object snapshot of the root store (MST 7.x module-level `getSnapshot`). */
export declare function getBackendRootSnapshot(): Record<string, unknown>
