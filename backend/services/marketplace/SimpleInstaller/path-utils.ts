import * as path from "path"

// v4 B2 (L3/L14): structural host-context view instead of the vscode ExtensionContext type.
import type { IExtensionContextView } from "@features/foundation/host-context/context"
// v4 B2 (L4): workspace roots come from the host context DI slot, not vscode directly.
import { getWorkspaceRoots } from "@features/foundation/host-context/context"

import { GlobalFileNames } from "@shared/globalFileNames"
import { ensureSettingsDirectoryExists } from "@utils/globalContext"

export async function getModeFilePath(target: "project" | "global", context: IExtensionContextView): Promise<string> {
	if (target === "project") {
		const workspaceRoot = getWorkspaceRoots()[0]
		if (!workspaceRoot) {
			throw new Error("No workspace folder found")
		}
		return path.join(workspaceRoot, ".jabberwockmodes")
	}
	const globalSettingsPath = await ensureSettingsDirectoryExists(context)
	return path.join(globalSettingsPath, GlobalFileNames.customModes)
}

export async function getMcpFilePath(target: "project" | "global", context: IExtensionContextView): Promise<string> {
	if (target === "project") {
		const workspaceRoot = getWorkspaceRoots()[0]
		if (!workspaceRoot) {
			throw new Error("No workspace folder found")
		}
		return path.join(workspaceRoot, ".jabberwock", "mcp.json")
	}
	const globalSettingsPath = await ensureSettingsDirectoryExists(context)
	return path.join(globalSettingsPath, GlobalFileNames.mcpSettings)
}
