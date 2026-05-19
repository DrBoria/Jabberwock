import { types, Instance } from "mobx-state-tree"

/**
 * CoreStateModel holds all simple serializable state that was previously
 * stored as module-level variables or EventBridge public properties.
 *
 * Non-serializable class instances (services, managers, etc.) are kept
 * in a separate ServiceRegistry (see ServiceRegistry.ts) that lives
 * alongside the MST store but outside of MST.
 */
export const CoreStateModel = types
	.model("CoreState", {
		// ── EventBridge public properties ────────────────────────────────
		cwd: types.string,
		latestAnnouncementId: types.string,
		settingsImportedAt: types.number,

		// ── networkProxy.ts flags ────────────────────────────────────────
		proxyInitialized: types.boolean,
		undiciProxyInitialized: types.boolean,
		fetchPatched: types.boolean,

		// ── extension.ts derived state ───────────────────────────────────
		cloudServiceAvailable: types.boolean,

		// ── Devtool HMR state ────────────────────────────────────────────
		wsMcpPort: types.number,
		diagnosticsIntercepting: types.boolean,
	})
	.actions((self) => ({
		setCwd(value: string) {
			self.cwd = value
		},
		setLatestAnnouncementId(value: string) {
			self.latestAnnouncementId = value
		},
		setSettingsImportedAt(value: number) {
			self.settingsImportedAt = value
		},
		setProxyInitialized(value: boolean) {
			self.proxyInitialized = value
		},
		setUndiciProxyInitialized(value: boolean) {
			self.undiciProxyInitialized = value
		},
		setFetchPatched(value: boolean) {
			self.fetchPatched = value
		},
		setCloudServiceAvailable(value: boolean) {
			self.cloudServiceAvailable = value
		},
		setWsMcpPort(value: number) {
			self.wsMcpPort = value
		},
		setDiagnosticsIntercepting(value: boolean) {
			self.diagnosticsIntercepting = value
		},
	}))

export type ICoreState = Instance<typeof CoreStateModel>
