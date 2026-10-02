/**
 * Type declaration for the shared backend chat feature barrel
 * (`backend/features/chat/index.ts`).
 *
 * This connector package resolves `@features/chat` to this declaration so its
 * own `tsc --noEmit` stays isolated from the backend source graph (which is
 * still partially vscode-coupled). The runtime/server bundle resolves the SAME
 * specifier to the real implementation via `backend/tsconfig.json` aliases, so
 * there is exactly one code path at runtime. Keep this declaration in sync with
 * the real `initializeStoreApiConfig` the server entrypoint calls.
 */

/**
 * Initialize the store API config for web mode (mirrors the vscode extension
 * bootstrap). Resolves once the provider/api configuration is loaded into the
 * shared store.
 */
export declare function initializeStoreApiConfig(): Promise<void>
