// v4 B2 (L14): structural host views instead of the vscode types. The mock only needs to satisfy
// IExtensionContextView — consumers read globalState/workspaceState/globalStorageUri/secrets, nothing more.
import type { IExtensionContextView } from "@features/foundation/host-context/context"

/**
 * Create a minimal extension-context view with only the properties needed
 * for mode loading and merging operations.
 * Note: callers should not invoke ensureSettingsDirectoryExists on this mock.
 */
export function createMockExtensionContext(): IExtensionContextView {
	const emptyMemento = {
		get: <T>(_key: string): T | undefined => undefined,
		update: async () => {},
		keys: (): readonly string[] => [],
	}

	return {
		subscriptions: [],
		globalState: emptyMemento,
		workspaceState: emptyMemento,
		// ensureSettingsDirectoryExists reads this; the mock is never used for real IO.
		globalStorageUri: { fsPath: "" },
	}
}

let _extensionContext: IExtensionContextView | undefined

/**
 * Initialize the modes file service with the extension context view.
 * Must be called once during extension activation (extension.ts).
 */
export function initModesFileService(context: IExtensionContextView): void {
	_extensionContext = context
}

export function requireContext(): IExtensionContextView {
	if (!_extensionContext) {
		throw new Error(
			"modesFileService not initialized. Call initModesFileService(context) during extension activation.",
		)
	}
	return _extensionContext
}
