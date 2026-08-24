import * as vscode from "vscode"

/**
 * Create a minimal ExtensionContext mock with only the properties needed
 * for mode loading and merging operations.
 * Note: callers should not invoke ensureSettingsDirectoryExists on this mock.
 */
export function createMockExtensionContext(): vscode.ExtensionContext {
	const mockSecretStorage: vscode.SecretStorage = {
		get: async () => undefined,
		store: async () => {},
		delete: async () => {},
		onDidChange: () => ({ dispose: () => {} }),
	}
	const mockMemento = {
		get: <T>(_key: string): T | undefined => undefined,
		update: async () => {},
		keys: (): readonly string[] => [],
		setKeysForSync: (_keys: readonly string[]): void => {},
	}
	const mockEnvCollection = {
		replace: () => {},
		append: () => {},
		prepend: () => {},
		get: () => undefined,
		forEach: () => {},
		delete: () => {},
		clear: () => {},
		persistent: false,
		description: "",
		[Symbol.iterator]: () => [][Symbol.iterator](),
		getScoped: () => mockEnvCollection,
	}
	const mockExtension: vscode.Extension<unknown> = {
		id: "",
		extensionUri: vscode.Uri.parse(""),
		extensionPath: "",
		isActive: false,
		packageJSON: {},
		extensionKind: vscode.ExtensionKind.UI,
		exports: undefined,
		activate: () => Promise.resolve(undefined),
	}
	const mockLanguageModelAccess: vscode.LanguageModelAccessInformation = {
		onDidChange: () => ({ dispose: () => {} }),
		canSendRequest: () => undefined,
	}

	return {
		subscriptions: [],
		extensionPath: "",
		extensionUri: vscode.Uri.parse(""),
		storagePath: undefined,
		globalStoragePath: "",
		logPath: "",
		extensionMode: vscode.ExtensionMode.Test,
		logUri: vscode.Uri.parse(""),
		storageUri: undefined,
		globalStorageUri: vscode.Uri.parse(""),
		asAbsolutePath: (path: string) => path,
		secrets: mockSecretStorage,
		environmentVariableCollection: mockEnvCollection,
		extension: mockExtension,
		languageModelAccessInformation: mockLanguageModelAccess,
		globalState: mockMemento as vscode.Memento & { setKeysForSync(keys: readonly string[]): void },
		workspaceState: mockMemento as vscode.Memento,
	}
}

let _extensionContext: vscode.ExtensionContext | undefined

/**
 * Initialize the modes file service with the extension context.
 * Must be called once during extension activation (extension.ts).
 */
export function initModesFileService(context: vscode.ExtensionContext): void {
	_extensionContext = context
}

export function requireContext(): vscode.ExtensionContext {
	if (!_extensionContext) {
		throw new Error(
			"modesFileService not initialized. Call initModesFileService(context) during extension activation.",
		)
	}
	return _extensionContext
}
