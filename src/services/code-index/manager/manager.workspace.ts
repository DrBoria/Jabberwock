import * as vscode from "vscode"

export class WorkspaceSettings {
	private readonly _folderUri: vscode.Uri
	private readonly context: vscode.ExtensionContext

	constructor(folderUri: vscode.Uri, context: vscode.ExtensionContext) {
		this._folderUri = folderUri
		this.context = context
	}

	private _workspaceEnabledKey(): string {
		return "codeIndexWorkspaceEnabled:" + this._folderUri.toString(true)
	}

	get isWorkspaceEnabled(): boolean {
		const explicit = this.context.workspaceState.get<boolean | undefined>(this._workspaceEnabledKey(), undefined)
		if (explicit !== undefined) return explicit
		return this.autoEnableDefault
	}

	async setWorkspaceEnabled(enabled: boolean): Promise<void> {
		await this.context.workspaceState.update(this._workspaceEnabledKey(), enabled)
	}

	get autoEnableDefault(): boolean {
		return this.context.globalState.get("codeIndexAutoEnableDefault", true)
	}

	async setAutoEnableDefault(enabled: boolean): Promise<void> {
		await this.context.globalState.update("codeIndexAutoEnableDefault", enabled)
	}
}
