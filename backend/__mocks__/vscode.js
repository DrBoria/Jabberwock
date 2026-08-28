// Minimal "vscode" module mock for vitest (referenced by backend/vitest.config.ts resolve.alias).
// The B3 EventBridge tests are transport-agnostic and never exercise the vscode API; this mock
// only exists so that any transitive import of "vscode" in a test module graph resolves cleanly.
// No-op objects are returned for every namespace/property access.

function noop() {}

function disposable() {
	return { dispose: noop }
}

const handler = {
	get(_target, prop) {
		if (prop === "ThemeIcon") return class ThemeIcon {}
		return noop
	},
	getPrototypeOf() {
		return null
	},
}

module.exports = new Proxy(
	{
		window: new Proxy({}, { get: () => disposable }),
		workspace: new Proxy({}, { get: () => disposable }),
		commands: new Proxy({}, { get: () => noop }),
		env: new Proxy({}, { get: () => noop }),
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
