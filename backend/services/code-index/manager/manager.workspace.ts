import * as path from "path"
import type { IExtensionContextView } from "@features/foundation/vscode/context"

/**
 * v4 B2 (L14): replicates `vscode.Uri.file(folderPath).toString(true)` — `"file://"` + the absolute POSIX path, no percent-encoding.
 * The memento key format must stay byte-identical to what extension mode wrote before this refactor so existing per-workspace enable flags remain valid.
 */
function folderUriString(folderPath: string): string {
	const posix = path.posix.normalize(path.resolve(folderPath).split(path.sep).join("/"))
	return "file://" + posix
}

export class WorkspaceSettings {
	private readonly _folderPath: string
	/** v4 B2 (L3): structural context view — real host contexts satisfy it structurally. */
	private readonly context: IExtensionContextView

	constructor(folderPath: string, context: IExtensionContextView) {
		this._folderPath = folderPath
		this.context = context
	}

	private _workspaceEnabledKey(): string {
		return "codeIndexWorkspaceEnabled:" + folderUriString(this._folderPath)
	}

	get isWorkspaceEnabled(): boolean {
		// v4 B2 (L3): the structural memento view has no default-value overload — `undefined` is already in the generic. Same semantics as before.
		const explicit = this.context.workspaceState.get<boolean | undefined>(this._workspaceEnabledKey())
		if (explicit !== undefined) return explicit
		return this.autoEnableDefault
	}

	async setWorkspaceEnabled(enabled: boolean): Promise<void> {
		await this.context.workspaceState.update(this._workspaceEnabledKey(), enabled)
	}

	get autoEnableDefault(): boolean {
		// v4 B2 (L3): the structural memento view has no default-value overload — apply it explicitly. Same semantics as before in extension mode.
		return this.context.globalState.get("codeIndexAutoEnableDefault") ?? true
	}

	async setAutoEnableDefault(enabled: boolean): Promise<void> {
		await this.context.globalState.update("codeIndexAutoEnableDefault", enabled)
	}
}
