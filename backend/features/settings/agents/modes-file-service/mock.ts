// v4 B2 (L14): structural host views instead of the vscode types. The mock only needs to satisfy
// IExtensionContextView — consumers read globalState/workspaceState/globalStorageUri/secrets, nothing more.
import type { IExtensionContextView } from "@features/foundation"

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

/** Module-level state holder for the mock extension context (L14: structural host view; the mock is never used for real IO). */
const _mockState: { extensionContext: IExtensionContextView | undefined } = { extensionContext: undefined }

/**
 * Initialize the modes file service with the extension context view.
 * Must be called once during extension activation (extension.ts).
 */
export function initModesFileService(context: IExtensionContextView): void {
	_mockState.extensionContext = context
}

export function requireContext(): IExtensionContextView {
	if (!_mockState.extensionContext) {
		throw new Error(
			"modesFileService not initialized. Call initModesFileService(context) during extension activation.",
		)
	}
	return _mockState.extensionContext
}
