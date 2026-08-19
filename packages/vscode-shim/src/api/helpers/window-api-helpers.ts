import { logs } from "../../utils/logger.ts"
import { Uri } from "../../classes/types/Uri.ts"
import { Position } from "../../classes/types/Position.ts"
import { Range } from "../../classes/types/Range.ts"
import { Selection } from "../../classes/types/Selection.ts"
import { ViewColumn } from "../../types.ts"
import type { TextEditor, TextDocumentShowOptions } from "../../interfaces/editor.ts"
import type { TextDocument } from "../../interfaces/document.ts"
import type {
	WebviewViewProvider,
	WebviewView,
	Webview,
	ViewBadge,
	WebviewViewProviderOptions,
} from "../../interfaces/webview.ts"
import type { Disposable } from "../../interfaces/workspace.ts"
import type { CancellationToken } from "../../interfaces/document.ts"
import type { IExtensionHost } from "../../interfaces/extension-host.ts"
import type { Thenable } from "../../types.ts"

interface GlobalWithExtensionHost {
	__extensionHost?: IExtensionHost
}

export function createPlaceholderEditor(
	uri: Uri,
	columnOrViewColumn?: ViewColumn | TextDocumentShowOptions,
): TextEditor {
	return {
		document: { uri } as TextDocument,
		selection: new Selection(new Position(0, 0), new Position(0, 0)),
		selections: [new Selection(new Position(0, 0), new Position(0, 0))],
		visibleRanges: [new Range(new Position(0, 0), new Position(0, 0))],
		options: {},
		viewColumn: typeof columnOrViewColumn === "number" ? columnOrViewColumn : ViewColumn.One,
		edit: () => Promise.resolve(true),
		insertSnippet: () => Promise.resolve(true),
		setDecorations: () => {},
		revealRange: () => {},
		show: () => {},
		hide: () => {},
	}
}

function createMockWebview(extensionHost: IExtensionHost): Webview {
	return {
		postMessage: (message: unknown): Thenable<boolean> => {
			extensionHost.emit("extensionWebviewMessage", message)
			return Promise.resolve(true)
		},
		onDidReceiveMessage: (listener: (message: unknown) => void) => {
			extensionHost.on("webviewMessage", listener)
			return { dispose: () => {} }
		},
		asWebviewUri: (uriArg: Uri) => Uri.parse(`vscode-webview://webview/${uriArg.path}`),
		html: "",
		options: {},
		cspSource: "vscode-webview:",
	}
}

function createMockWebviewView(viewId: string, webview: Webview): WebviewView {
	return {
		webview,
		viewType: viewId,
		title: viewId,
		description: undefined as string | undefined,
		badge: undefined as ViewBadge | undefined,
		show: () => {},
		onDidChangeVisibility: () => ({ dispose: () => {} }),
		onDidDispose: () => ({ dispose: () => {} }),
		visible: true,
	}
}

export function registerWebviewProvider(
	viewId: string,
	provider: WebviewViewProvider,
	_options?: WebviewViewProviderOptions,
): Disposable {
	const extensionHost = (globalThis as GlobalWithExtensionHost).__extensionHost
	if (extensionHost) {
		extensionHost.registerWebviewProvider(viewId, provider)
		const webview = createMockWebview(extensionHost)
		if (provider.resolveWebviewView) {
			const mockWebviewView = createMockWebviewView(viewId, webview)
			;(async () => {
				try {
					const context = { preserveFocus: false, isInitialSetup: extensionHost.isInInitialSetup() }
					logs.debug(
						`Calling resolveWebviewView with isInitialSetup=${context.isInitialSetup}`,
						"VSCode.Window",
					)
					await provider.resolveWebviewView(mockWebviewView, {}, {} as CancellationToken)
					extensionHost.markWebviewReady()
					logs.debug("Webview resolution complete, marked as ready", "VSCode.Window")
				} catch (error) {
					logs.error("Error resolving webview view", "VSCode.Window", { error })
				}
			})()
		}
	}
	return {
		dispose: () => {
			if (extensionHost) extensionHost.unregisterWebviewProvider(viewId)
		},
	}
}
