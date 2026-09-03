// Minimal "vscode" module mock for vitest (referenced by backend/vitest.config.ts resolve.alias).
// The B3 EventBridge tests are transport-agnostic and never exercise the vscode API; this mock
// only exists so that any transitive import of "vscode" in a test module graph resolves cleanly.
// No-op objects are returned for every namespace/property access.

function noop() {}

function disposable() {
	return { dispose: noop }
}

const handler = {
	get(target, prop) {
		if (prop === "ThemeIcon") return class ThemeIcon {}
		return Object.hasOwn(target, prop) ? target[prop] : noop
	},
	getPrototypeOf() {
		return null
	},
}

module.exports = new Proxy(
	{
		// window exposes real array shapes for the APIs production code maps over (condense context gathering); everything else keeps the legacy no-op fallback.
		window: new Proxy(
			{ visibleTextEditors: [], tabGroups: { all: [] } },
			{
				get(t, p) {
					return Object.hasOwn(t, p) ? t[p] : disposable
				},
			},
		),
		// workspace exposes a minimal WorkspaceConfiguration shape for settings reads in system-prompt construction (get(key) / get(key, default)); everything else keeps the legacy no-op fallback.
		workspace: new Proxy(
			{
				getConfiguration() {
					return {
						get(_key, defaultValue) {
							return defaultValue
						},
						has() {
							return false
						},
						update() {
							return Promise.resolve()
						},
					}
				},
			},
			{
				get(t, p) {
					return Object.hasOwn(t, p) ? t[p] : disposable
				},
			},
		),
		commands: new Proxy({}, { get: () => noop }),
		// env exposes real string shapes for locale/appRoot reads in environment-details gathering (formatLanguage calls .replace on the locale); everything else keeps the legacy no-op fallback.
		env: new Proxy(
			{ language: "en", appRoot: "/tmp/jabberwock-mock" },
			{
				get(t, p) {
					return Object.hasOwn(t, p) ? t[p] : noop
				},
			},
		),
		Uri: { joinPath: () => ({ fsPath: "" }), parse: () => ({ fsPath: "" }) },
		Disposable: { from: () => disposable() },
		EventEmitter: class EventEmitter {
			event = noop
			fire() {}
			dispose() {}
		},
	},
	handler,
)
