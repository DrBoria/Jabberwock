import { types, Instance } from "mobx-state-tree"

/**
 * DiagnosticsStore — tracks diagnostics state.
 * Receives snapshots from the extension-side DiagnosticsStore via MstBridge.
 */
export const DiagnosticsStore = types
	.model("DiagnosticsStore", {
		diagnostics: types.maybe(types.frozen<any>()),
	})
	.actions((self) => ({
		setDiagnostics(diagnostics: any) {
			self.diagnostics = diagnostics
		},
	}))

export type IDiagnosticsStore = Instance<typeof DiagnosticsStore>
export const diagnosticsStore = DiagnosticsStore.create({})
