import type { IExtensionContextView } from "@features/foundation"
import { getWorkspaceRoots } from "@features/foundation"

import { CodeIndexManager } from "./main"

const __moduleState = {
	_instances: new Map<string, CodeIndexManager>(),
}
/** v4 B2 (L3): widened to the structural context view — real host contexts satisfy it structurally. */
export function getCodeIndexManager(
	context: IExtensionContextView,
	workspacePath?: string,
): CodeIndexManager | undefined {
	// v4 B2 (L4): workspace roots come from "the" host-context DI slot; an explicit path is trusted as-is.
	// The active-editor heuristic was a vscode-only convenience and is out of scope for v1 (plan §2.3 L4).
	const resolvedPath = workspacePath ?? getWorkspaceRoots()[0]
	if (!resolvedPath) return undefined

	if (!__moduleState._instances.has(resolvedPath)) {
		__moduleState._instances.set(resolvedPath, CodeIndexManager(resolvedPath, context))
	}
	return __moduleState._instances.get(resolvedPath)!
}

export function getAllCodeIndexManagers(): CodeIndexManager[] {
	const managers = Array.from(__moduleState._instances.values())
	return managers
}
