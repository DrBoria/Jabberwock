import { types, Instance } from "mobx-state-tree"

import type { DiagnosticSnapshot } from "@jabberwock/types"

/**
 * DiagnosticsStore — tracks diagnostics state.
 * Receives snapshots from the extension-side DiagnosticsStore via MstBridge.
 */
export const DiagnosticsStore = types
	.model("DiagnosticsStore", {
		diagnostics: types.frozen<DiagnosticSnapshot>(),
	})
	.actions((self) => ({
		setDiagnostics(diagnostics: DiagnosticSnapshot) {
			self.diagnostics = diagnostics
		},
	}))

export type IDiagnosticsStore = Instance<typeof DiagnosticsStore>
export const diagnosticsStore = DiagnosticsStore.create({ diagnostics: { logs: [], metrics: [], resources: [] } })
