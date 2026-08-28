import type { IExtensionContextView } from "@features/foundation/vscode/context"
import { getSettingsDirectoryPath } from "./io/storage"

/** v4 B2 (L3/L7): widened to the structural context view — real host contexts satisfy it structurally, so all existing callers compile unchanged. */
export async function ensureSettingsDirectoryExists(context: IExtensionContextView): Promise<string> {
	// getSettingsDirectoryPath already handles the custom storage path setting
	return await getSettingsDirectoryPath(context.globalStorageUri.fsPath)
}
