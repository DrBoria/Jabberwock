import type { CancellationToken } from "../../interfaces/document.ts"
import type { Disposable, DiagnosticCollection } from "../../interfaces/workspace.ts"
import type { UriHandler } from "../../interfaces/webview.ts"
import { Diagnostic } from "../../classes/types/Additional.ts"
import { Uri } from "../../classes/types/Uri.ts"

export class CancellationTokenClass implements CancellationToken {
	isCancellationRequested = false
	onCancellationRequested = (_listener: (e: unknown) => void) => ({ dispose: () => {} })
}

export class DisposableClass implements Disposable {
	dispose(): void {}
	static from(...disposables: Disposable[]): Disposable {
		return {
			dispose: () => {
				disposables.forEach((d) => d.dispose())
			},
		}
	}
}

export class TabInputText {
	constructor(public uri: Uri) {}
}

export class TabInputTextDiff {
	constructor(
		public original: Uri,
		public modified: Uri,
	) {}
}

export function createLanguagesObject(): Record<string, unknown> {
	return {
		registerCodeActionsProvider: () => ({ dispose: () => {} }),
		registerCodeLensProvider: () => ({ dispose: () => {} }),
		registerCompletionItemProvider: () => ({ dispose: () => {} }),
		registerHoverProvider: () => ({ dispose: () => {} }),
		registerDefinitionProvider: () => ({ dispose: () => {} }),
		registerReferenceProvider: () => ({ dispose: () => {} }),
		registerDocumentSymbolProvider: () => ({ dispose: () => {} }),
		registerWorkspaceSymbolProvider: () => ({ dispose: () => {} }),
		registerRenameProvider: () => ({ dispose: () => {} }),
		registerDocumentFormattingEditProvider: () => ({ dispose: () => {} }),
		registerDocumentRangeFormattingEditProvider: () => ({ dispose: () => {} }),
		registerSignatureHelpProvider: () => ({ dispose: () => {} }),
		getDiagnostics: (uri?: Uri): [Uri, Diagnostic[]][] | Diagnostic[] => {
			if (uri) return []
			return []
		},
		createDiagnosticCollection: (name?: string): DiagnosticCollection => {
			const diagnostics = new Map<string, Diagnostic[]>()
			const collection: DiagnosticCollection = {
				name: name || "default",
				set: (
					uriOrEntries: Uri | [Uri, Diagnostic[] | undefined][],
					diagnosticsOrUndefined?: Diagnostic[] | undefined,
				) => {
					if (Array.isArray(uriOrEntries)) {
						for (const [uri, diags] of uriOrEntries) {
							if (diags === undefined) diagnostics.delete(uri.toString())
							else diagnostics.set(uri.toString(), diags)
						}
					} else {
						if (diagnosticsOrUndefined === undefined) diagnostics.delete(uriOrEntries.toString())
						else diagnostics.set(uriOrEntries.toString(), diagnosticsOrUndefined)
					}
				},
				delete: (uri: Uri) => {
					diagnostics.delete(uri.toString())
				},
				clear: () => {
					diagnostics.clear()
				},
				forEach: (
					callback: (uri: Uri, diagnostics: Diagnostic[], collection: DiagnosticCollection) => void,
					thisArg?: unknown,
				) => {
					diagnostics.forEach((diags, uriString) =>
						callback.call(thisArg, Uri.parse(uriString), diags, collection),
					)
				},
				get: (uri: Uri) => diagnostics.get(uri.toString()),
				has: (uri: Uri) => diagnostics.has(uri.toString()),
				dispose: () => {
					diagnostics.clear()
				},
			}
			return collection
		},
	}
}

export function createExtensionsObject(context: { extensionUri: Uri; extensionPath: string }) {
	return {
		all: [],
		getExtension: (extensionId: string) => {
			if (extensionId === "RooVeterinaryInc.jabberwock") {
				return {
					id: extensionId,
					extensionUri: context.extensionUri,
					extensionPath: context.extensionPath,
					isActive: true,
					packageJSON: {},
					exports: undefined,
					activate: () => Promise.resolve(),
				}
			}
			return undefined
		},
		onDidChange: () => ({ dispose: () => {} }),
	}
}

export class FileSystemWatcherClass {
	onDidChange = () => ({ dispose: () => {} })
	onDidCreate = () => ({ dispose: () => {} })
	onDidDelete = () => ({ dispose: () => {} })
	dispose = () => {}
}

export class RelativePatternClass {
	constructor(
		public base: string,
		public pattern: string,
	) {}
}

export class UriHandlerClass implements UriHandler {
	handleUri = (_uri: Uri) => {}
}
