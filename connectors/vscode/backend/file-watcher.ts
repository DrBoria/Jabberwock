import * as vscode from "vscode"
import * as path from "node:path"
import type {
	DisposableLike,
	IFileWatcher,
	IFileWatcherFactory,
} from "../../../packages/types/src/protocol/backend-connector.ts"

/**
 * v4 D4e (plan §3.2 Strategy E): vscode-backed file-watcher factory for extension mode.
 *
 * Fills the optional `fileWatchers` capability slot that server mode fills with chokidar
 * (`ChokidarFileWatcherFactory`). Adapts the host `vscode.workspace.createFileSystemWatcher`
 * API into the host-neutral `IFileWatcher` callbacks (absolute fs paths). One host watcher is
 * created per pattern; the returned watcher merges their events. The `cwd` option is ignored —
 * host glob patterns are already workspace-relative.
 *
 * D4g-2 (batch 2): absolute-path patterns are adapted to a host `RelativePattern` (dir + basename)
 * so the host watcher matches the exact file, mirroring the pre-batch-2 `watchers.ts` behavior.
 * Glob patterns (e.g. `"**"`) are passed through unchanged.
 */
export class VscodeFileWatcherFactory implements IFileWatcherFactory {
	async watch(patterns: string[], opts?: { cwd?: string }): Promise<IFileWatcher> {
		const watchers = patterns.map((pattern) =>
			vscode.workspace.createFileSystemWatcher(toHostPattern(pattern, opts?.cwd)),
		)
		return new VscodeFileWatcher(watchers)
	}
}

/**
 * Convert a host-neutral pattern to a host watcher pattern.
 *
 * - Absolute paths become a `RelativePattern` (dir + basename) so the host watcher matches the
 *   exact file (D4g-2 batch 2).
 * - Relative patterns are anchored to `cwd` (when provided) via a `RelativePattern` (D4g-2 batch 3),
 *   mirroring the pre-batch-3 `new vscode.RelativePattern(workspacePath, glob)` behavior; without
 *   `cwd` they are passed through unchanged (workspace-relative, as before).
 */
function toHostPattern(pattern: string, cwd?: string): string | vscode.RelativePattern {
	if (path.isAbsolute(pattern)) {
		return new vscode.RelativePattern(path.dirname(pattern), path.basename(pattern))
	}
	if (cwd) {
		return new vscode.RelativePattern(cwd, pattern)
	}
	return pattern
}

class VscodeFileWatcher implements IFileWatcher {
	private readonly watchers: vscode.FileSystemWatcher[]

	constructor(watchers: vscode.FileSystemWatcher[]) {
		this.watchers = watchers
	}

	onCreate(handler: (path: string) => void): DisposableLike {
		const subs = this.watchers.map((w) => w.onDidCreate((uri) => handler(uri.fsPath)))
		return { dispose: () => subs.forEach((s) => s.dispose()) }
	}

	onChange(handler: (path: string) => void): DisposableLike {
		const subs = this.watchers.map((w) => w.onDidChange((uri) => handler(uri.fsPath)))
		return { dispose: () => subs.forEach((s) => s.dispose()) }
	}

	onDelete(handler: (path: string) => void): DisposableLike {
		const subs = this.watchers.map((w) => w.onDidDelete((uri) => handler(uri.fsPath)))
		return { dispose: () => subs.forEach((s) => s.dispose()) }
	}

	close(): void {
		// No-op: the host watchers are disposed by `dispose()`; `close()` mirrors the chokidar
		// factory's surface so consumers can call either without a host-specific branch.
	}

	dispose(): void {
		this.watchers.forEach((w) => w.dispose())
	}
}
