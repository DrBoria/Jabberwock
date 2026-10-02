/**
 * Type declaration for the shared backend webview API-config initializer
 * (`backend/features/chat/task/handlers/on-webview-launched/webview-api-config.ts`).
 *
 * This connector package resolves
 * `@features/chat/task/handlers/on-webview-launched/webview-api-config` to this declaration so
 * its own `tsc --noEmit` stays isolated from "the" backend source graph (which is still partially
 * vscode-coupled). The runtime/server bundle resolves the SAME specifier to the real
 * implementation via `backend/tsconfig.json` aliases, so there is exactly one code path at
 * runtime. Keep this declaration in sync with the real `initializeStoreApiConfig` signature.
 */

/** Populate the MST apiConfig store (profile list + current profile) at backend startup. */
export declare function initializeStoreApiConfig(): Promise<void>
