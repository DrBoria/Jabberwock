import { watch as chokidarWatch } from "chokidar"
import type { FSWatcher } from "chokidar"
import type {
	DisposableLike,
	IFileWatcher,
	IFileWatcherFactory,
} from "../../../../packages/types/src/protocol/backend-connector.ts"

/**
 * v4 Phase C1 (§4.3): chokidar-based file watcher factory for standalone server mode.
 *
 * Fills the optional `fileWatchers` capability slot that vscode mode fills with the host
 * `createFileSystemWatcher`. Server mode needs its own Node implementation; chokidar is
 * already a dependency of the `jabberwock` backend package, so it is reused rather than
 * introducing a new dependency.
 */
export class ChokidarFileWatcherFactory implements IFileWatcherFactory {
	async watch(patterns: string[], opts?: { cwd?: string }): Promise<IFileWatcher> {
		const watcher = chokidarWatch(patterns, {
			cwd: opts?.cwd,
			ignoreInitial: true,
		})
		return new ChokidarFileWatcher(watcher)
	}
}

class ChokidarFileWatcher implements IFileWatcher {
	private readonly watcher: FSWatcher
	private readonly createHandlers = new Set<(filePath: string) => void>()
	private readonly changeHandlers = new Set<(filePath: string) => void>()
	private readonly deleteHandlers = new Set<(filePath: string) => void>()

	constructor(watcher: FSWatcher) {
		this.watcher = watcher
		watcher.on("add", (filePath) => this.emit(this.createHandlers, filePath))
		watcher.on("change", (filePath) => this.emit(this.changeHandlers, filePath))
		watcher.on("unlink", (filePath) => this.emit(this.deleteHandlers, filePath))
	}

	onCreate(handler: (filePath: string) => void): DisposableLike {
		this.createHandlers.add(handler)
		return { dispose: () => this.createHandlers.delete(handler) }
	}

	onChange(handler: (filePath: string) => void): DisposableLike {
		this.changeHandlers.add(handler)
		return { dispose: () => this.changeHandlers.delete(handler) }
	}

	onDelete(handler: (filePath: string) => void): DisposableLike {
		this.deleteHandlers.add(handler)
		return { dispose: () => this.deleteHandlers.delete(handler) }
	}

	close(): void {
		void this.watcher.close()
	}

	dispose(): void {
		this.close()
	}

	private emit(handlers: Set<(filePath: string) => void>, filePath: string): void {
		for (const handler of [...handlers]) handler(filePath)
	}
}
