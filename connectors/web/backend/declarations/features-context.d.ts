/**
 * Type declaration for the backend context feature (`backend/features/context/index.ts`, ICG-C1).
 *
 * This connector package resolves `@features/context` to this declaration so its own
 * `tsc --noEmit` stays isolated from the backend source graph (which is still partially
 * vscode-coupled — reports/audit-platform.json). The runtime/server bundle resolves the
 * SAME specifier to the real implementation via `backend/tsconfig.json` (`@features/*`),
 * so there is exactly one code path at runtime. Keep this declaration in sync with the
 * signatures exported by `backend/features/context/index.ts`.
 */

/** Bounded per-task archive metadata snapshot for hello->state payloads (ICG doc §7.3) - content never included, by design. */
export declare function getContextWindowMeta(): Record<string, { totalSeqCount: number; freshTailFromSeq: number }>
