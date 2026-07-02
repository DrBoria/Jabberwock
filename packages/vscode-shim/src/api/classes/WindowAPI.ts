import { logs } from "../../utils/logger.ts"
import { createPlaceholderEditor, registerWebviewProvider } from "../helpers/window-api-helpers.ts"
import { Uri } from "../../classes/types/Uri.ts"
import { EventEmitter } from "../../classes/events/EventEmitter.ts"
import { ThemeIcon } from "../../classes/types/Additional.ts"
import { OutputChannel } from "../../classes/window/OutputChannel.ts"
import { StatusBarItem } from "../../classes/window/StatusBarItem.ts"
import { TextEditorDecorationType } from "../../classes/window/TextEditorDecorationType.ts"
import { TabGroupsAPI } from "./TabGroupsAPI.ts"
import { StatusBarAlignment, ViewColumn } from "../../types.ts"
import type { WorkspaceAPI } from "./WorkspaceAPI.ts"
import type { Thenable } from "../../types.ts"
import type {
	TextEditor,
	TextEditorSelectionChangeEvent,
	TextDocumentShowOptions,
	DecorationRenderOptions,
} from "../../interfaces/editor.ts"
import type { TextDocument } from "../../interfaces/document.ts"
import type { Terminal } from "../../interfaces/terminal.ts"
import type { Disposable } from "../../interfaces/workspace.ts"
import type { WebviewViewProvider, WebviewViewProviderOptions } from "../../interfaces/webview.ts"

export class WindowAPI {
	public tabGroups: TabGroupsAPI
	public visibleTextEditors: TextEditor[] = []
	public _onDidChangeVisibleTextEditors = new EventEmitter<TextEditor[]>()
	private _workspace?: WorkspaceAPI
	private static _decorationCounter = 0

	constructor() {
		this.tabGroups = new TabGroupsAPI()
	}

	setWorkspace(workspace: WorkspaceAPI) {
		this._workspace = workspace
	}

	createOutputChannel(name: string): OutputChannel {
		return new OutputChannel(name)
	}

	createStatusBarItem(
		idOrAlignment?: string | StatusBarAlignment,
		alignmentOrPriority?: StatusBarAlignment | number,
		priority?: number,
	): StatusBarItem {
		const actualAlignment =
			typeof idOrAlignment === "string"
				? ((alignmentOrPriority as StatusBarAlignment) ?? StatusBarAlignment.Left)
				: ((idOrAlignment as StatusBarAlignment) ?? StatusBarAlignment.Left)
		const actualPriority =
			typeof idOrAlignment === "string" ? priority : (alignmentOrPriority as number | undefined)
		return new StatusBarItem(actualAlignment, actualPriority)
	}

	createTextEditorDecorationType(_options: DecorationRenderOptions): TextEditorDecorationType {
		return new TextEditorDecorationType(`decoration-${++WindowAPI._decorationCounter}`)
	}

	createTerminal(options?: {
		name?: string
		shellPath?: string
		shellArgs?: string[]
		cwd?: string
		env?: { [key: string]: string | null | undefined }
		iconPath?: ThemeIcon
		hideFromUser?: boolean
		message?: string
		strictEnv?: boolean
	}): Terminal {
		return {
			name: options?.name || "Terminal",
			processId: Promise.resolve(undefined),
			creationOptions: options || {},
			exitStatus: undefined,
			state: { isInteractedWith: false },
			sendText: (text: string) => {
				logs.debug(`Terminal sendText: ${text}`, "VSCode.Terminal")
			},
			show: () => {
				logs.debug("Terminal show called", "VSCode.Terminal")
			},
			hide: () => {
				logs.debug("Terminal hide called", "VSCode.Terminal")
			},
			dispose: () => {
				logs.debug("Terminal disposed", "VSCode.Terminal")
			},
		}
	}

	showInformationMessage(message: string): Thenable<string | undefined> {
		logs.info(message, "VSCode.Window")
		return Promise.resolve(undefined)
	}
	showWarningMessage(message: string): Thenable<string | undefined> {
		logs.warn(message, "VSCode.Window")
		return Promise.resolve(undefined)
	}
	showErrorMessage(message: string): Thenable<string | undefined> {
		logs.error(message, "VSCode.Window")
		return Promise.resolve(undefined)
	}
	showQuickPick(items: string[]): Thenable<string | undefined> {
		return Promise.resolve(items[0])
	}
	showInputBox(): Thenable<string | undefined> {
		return Promise.resolve("")
	}
	showOpenDialog(): Thenable<Uri[] | undefined> {
		return Promise.resolve([])
	}

	async showTextDocument(
		documentOrUri: TextDocument | Uri,
		columnOrOptions?: ViewColumn | TextDocumentShowOptions,
		_preserveFocus?: boolean,
	): Promise<TextEditor> {
		const uri = documentOrUri instanceof Uri ? documentOrUri : documentOrUri.uri
		logs.debug(`showTextDocument called for: ${uri?.toString() || "unknown"}`, "VSCode.Window")

		const placeholderEditor = createPlaceholderEditor(uri, columnOrOptions)
		this.visibleTextEditors.push(placeholderEditor)
		logs.debug(
			`Placeholder editor added to visibleTextEditors, total: ${this.visibleTextEditors.length}`,
			"VSCode.Window",
		)

		let document: TextDocument | Uri = documentOrUri
		if (documentOrUri instanceof Uri && this._workspace) {
			logs.debug("Opening document via workspace.openTextDocument", "VSCode.Window")
			document = await this._workspace.openTextDocument(uri)
			logs.debug("Document opened successfully", "VSCode.Window")
			placeholderEditor.document = document
		}

		setImmediate(() => {
			logs.debug("Firing onDidChangeVisibleTextEditors event", "VSCode.Window")
			this._onDidChangeVisibleTextEditors.fire(this.visibleTextEditors)
			logs.debug("onDidChangeVisibleTextEditors event fired", "VSCode.Window")
		})

		logs.debug("Returning editor from showTextDocument", "VSCode.Window")
		return placeholderEditor
	}

	registerWebviewViewProvider(
		viewId: string,
		provider: WebviewViewProvider,
		_options?: WebviewViewProviderOptions,
	): Disposable {
		return registerWebviewProvider(viewId, provider, _options)
	}

	registerUriHandler(): Disposable {
		return { dispose: () => {} }
	}
	onDidChangeTextEditorSelection(listener: (event: TextEditorSelectionChangeEvent) => void): Disposable {
		return new EventEmitter<TextEditorSelectionChangeEvent>().event(listener)
	}
	onDidChangeActiveTextEditor(listener: (event: TextEditor | undefined) => void): Disposable {
		return new EventEmitter<TextEditor | undefined>().event(listener)
	}
	onDidChangeVisibleTextEditors(listener: (editors: TextEditor[]) => void): Disposable {
		return this._onDidChangeVisibleTextEditors.event(listener)
	}
	onDidCloseTerminal(): Disposable {
		return { dispose: () => {} }
	}
	onDidOpenTerminal(): Disposable {
		return { dispose: () => {} }
	}
	onDidChangeActiveTerminal(): Disposable {
		return { dispose: () => {} }
	}
	onDidChangeTerminalDimensions(): Disposable {
		return { dispose: () => {} }
	}
	onDidWriteTerminalData(): Disposable {
		return { dispose: () => {} }
	}
	get activeTerminal(): Terminal | undefined {
		return undefined
	}
	get terminals(): Terminal[] {
		return []
	}
}
