import * as path from "path"
import type { IExtensionContextView } from "@features/foundation/host-context/context"

/**
 * v4 B2 (L14): replicates `vscode.Uri.file(folderPath).toString(true)` — `"file://"` + the absolute POSIX path, no percent-encoding.
 * The memento key format must stay byte-identical to what extension mode wrote before this refactor so existing per-workspace enable flags remain valid.
 */
function folderUriString(folderPath: string): string {
	const posix = path.posix.normalize(path.resolve(folderPath).split(path.sep).join("/"))
	return "file://" + posix
}

export function WorkspaceSettings(folderPath: string, context: IExtensionContextView) {
	const _folderPath = folderPath

	const handler = {
		_folderPath: _folderPath,
		context,
		_workspaceEnabledKey(): string {
			return "codeIndexWorkspaceEnabled:" + folderUriString(handler._folderPath)
		},
		get isWorkspaceEnabled(): boolean {
			// v4 B2 (L3): the structural memento view has no default-value overload  `undefined` is already in the generic. Same semantics as before.
			const explicit = handler.context.workspaceState.get<boolean | undefined>(handler._workspaceEnabledKey())
			if (explicit !== undefined) return explicit
			return handler.autoEnableDefault
		},
		get autoEnableDefault(): boolean {
			// v4 B2 (L3): the structural memento view has no default-value overload  apply it explicitly. Same semantics as before in extension mode.
			return handler.context.globalState.get("codeIndexAutoEnableDefault") ?? true
		},
		async setWorkspaceEnabled(enabled: boolean): Promise<void> {
			await handler.context.workspaceState.update(handler._workspaceEnabledKey(), enabled)
		},
		async setAutoEnableDefault(enabled: boolean): Promise<void> {
			await handler.context.globalState.update("codeIndexAutoEnableDefault", enabled)
		},
	}
	return handler
}
