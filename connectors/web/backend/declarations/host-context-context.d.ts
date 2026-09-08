/**
 * Type declaration for the shared backend host-context slot installer
 * (`backend/features/foundation/host-context/context.ts`).
 *
 * This connector package resolves `@features/foundation/host-context/context` to this
 * declaration so its own `tsc --noEmit` stays isolated from the backend source graph (which
 * is still partially vscode-coupled). The runtime/server bundle resolves the SAME specifier to
 * the real implementation via `backend/tsconfig.json` aliases, so there is exactly one code
 * path at runtime. Keep this declaration in sync with the real `installBackendState` signature.
 */
import type { IHashmapMemory } from "@jabberwock/types"

/** Structural view of the backend state slots that the standalone server installs at startup. */
export interface BackendStateSlots {
	hashmapMemory?: IHashmapMemory
	extensionRootPath: string
	globalStoragePath: string
	isDevelopmentMode: boolean
}

/**
 * Install backend state slots once during startup. The standalone server passes file-backed
 * slots (hashmapMemory as the memento source, storage dir as both root and global storage).
 */
export declare function installBackendState(slots: BackendStateSlots): void
