/**
 * Module-holder for the VS Code module (D4g-pre, C-2).
 *
 * The shared cloud package must not import "vscode" at runtime (C-2 purity). The vscode
 * connector hands the module over at activation via setVscodeModule(); importVscode() then
 * returns the held module, or undefined in server mode (consumers already handle undefined).
 * `typeof import("vscode")` is a type-only reference (erased at compile time) and is C-2 safe.
 */

let vscodeModule: typeof import("vscode") | undefined

/** Set the vscode module (called by the vscode connector at activation). */
export function setVscodeModule(mod: typeof import("vscode") | undefined): void {
	vscodeModule = mod
}

/** Returns the vscode module if set, else undefined. */
export async function importVscode(): Promise<typeof import("vscode") | undefined> {
	return vscodeModule
}
