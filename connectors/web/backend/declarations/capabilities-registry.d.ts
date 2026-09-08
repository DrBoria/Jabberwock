/**
 * Type declaration for the shared backend capability registry
 * (`backend/features/foundation/capabilities/registry.ts`).
 *
 * This connector package resolves `@features/foundation/capabilities/registry` to this
 * declaration so its own `tsc --noEmit` stays isolated from the backend source graph (which
 * is still partially vscode-coupled). The runtime/server bundle resolves the SAME specifier to
 * the real implementation via `backend/tsconfig.json` aliases, so there is exactly one code
 * path at runtime. Keep this declaration in sync with the real registry signatures.
 */
import type { BackendCapabilities } from "@jabberwock/types"

/**
 * Install the process-wide backend capabilities once at startup (mirror of the real
 * `setBackendCapabilities`). Throws on double-install to catch bootstrap ordering bugs.
 */
export declare function setBackendCapabilities(capabilities: BackendCapabilities): void
