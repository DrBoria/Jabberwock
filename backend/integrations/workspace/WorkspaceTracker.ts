import { stat } from "fs/promises"
import { VirtualWorkspace } from "@features/foundation/time-machine/VirtualWorkspace"
import * as path from "path"

import { listFiles } from "@services/glob/list-files"
import { type ProviderHandle } from "@features/foundation/webview/EventBridge"
import { toRelativePath, getWorkspacePath } from "@utils/io/path"
import { getBackendRootStore } from "@features/storeSingleton"
import { getFileWatchers, getTabGroups } from "@features/foundation/capabilities/registry"

const MAX_INITIAL_FILES = 1_000

// Note: this is not a drop-in replacement for listFiles at the start of tasks, since that will be done for Desktops when there is no workspace selected
class WorkspaceTracker {
	private providerRef: WeakRef<ProviderHandle>
	private disposables: Array<{ dispose(): void }> = []
	private filePaths: Set<string> = new Set()
	private updateTimer: NodeJS.Timeout | null = null
	private prevWorkSpacePath: string | undefined
	private resetTimer: NodeJS.Timeout | null = null
	private virtualWorkspace = new VirtualWorkspace()
	private disposed = false

	get cwd() {
		return getWorkspacePath()
	}
	constructor(provider: ProviderHandle) {
		this.providerRef = new WeakRef(provider)
		this.registerListeners()
	}

	async initializeFilePaths() {
		// should not auto get filepaths for desktop since it would immediately show permission popup before jabberwock ever creates a file
		if (!this.cwd) {
			return
		}
		const tempCwd = this.cwd
		const [files, _] = await listFiles(tempCwd, true, MAX_INITIAL_FILES, this.virtualWorkspace)
		if (this.prevWorkSpacePath !== tempCwd) {
			return
		}
		files.slice(0, MAX_INITIAL_FILES).forEach((file) => this.filePaths.add(this.normalizeFilePath(file)))
		this.workspaceDidUpdate()
	}

	private registerListeners() {
		this.prevWorkSpacePath = this.cwd

		// D4e (plan section 3.2 Strategy E): file watching goes through the host-neutral fileWatchers
		// capability slot (vscode mode: createFileSystemWatcher; server mode: chokidar). The
		// factory is optional, so a host that does not provide one degrades to no file watching.
		const factory = getFileWatchers()
		if (factory && this.cwd) {
			void factory
				.watch(["**"], { cwd: this.cwd })
				.then((watcher) => {
					if (this.disposed) {
						watcher.dispose()
						return
					}
					if (watcher.onCreate) {
						this.disposables.push(
							watcher.onCreate(async (filePath) => {
								await this.addFilePath(filePath)
								this.workspaceDidUpdate()
							}),
						)
					}
					// Renaming files triggers a delete and create event
					if (watcher.onDelete) {
						this.disposables.push(
							watcher.onDelete(async (filePath) => {
								if (await this.removeFilePath(filePath)) {
									this.workspaceDidUpdate()
								}
							}),
						)
					}
					this.disposables.push(watcher)
				})
				.catch((error) => {
					console.error("[WorkspaceTracker] failed to start file watcher:", error)
				})
		}

		// Listen for tab changes and call workspaceDidUpdate directly. Tab groups are a host UI
		// concept (D4e, plan section 3.2 Strategy E): server mode does not provide the slot, so the
		// subscription is skipped and the opened-tabs list degrades to empty.
		const tabGroups = getTabGroups()
		if (tabGroups) {
			this.disposables.push(
				tabGroups.onDidChange(() => {
					// Reset if workspace path has changed
					if (this.prevWorkSpacePath !== this.cwd) {
						this.workspaceDidReset()
					} else {
						// Otherwise just update
						this.workspaceDidUpdate()
					}
				}),
			)
		}
	}

	private getOpenedTabsInfo() {
		// D4e (plan section 3.2 Strategy E): opened tabs come from the host-neutral tabGroups capability
		// slot. Server mode does not provide the slot, so the list degrades to empty.
		const tabGroups = getTabGroups()
		if (!tabGroups) {
			return [] as Array<{ label: string; isActive: boolean; path: string }>
		}
		return tabGroups.all().reduce(
			(acc, group) => {
				const groupTabs = group.tabs.map((tab) => ({
					label: tab.label,
					isActive: tab.isActive,
					path: toRelativePath(tab.path, this.cwd || ""),
				}))

				groupTabs.forEach((tab) => (tab.isActive ? acc.unshift(tab) : acc.push(tab)))
				return acc
			},
			[] as Array<{ label: string; isActive: boolean; path: string }>,
		)
	}

	private async workspaceDidReset() {
		if (this.resetTimer) {
			clearTimeout(this.resetTimer)
		}
		this.resetTimer = setTimeout(async () => {
			if (this.prevWorkSpacePath !== this.cwd) {
				const provider = this.providerRef.deref()
				await provider?.postMessageToWebview({
					type: "workspaceUpdated",
					uri: this.cwd,
					filePaths: [],
					openedTabs: this.getOpenedTabsInfo(),
				})
				// Dual-write: MST store
				getBackendRootStore().foundation.windowManager.setWorkspaceStore({
					filePaths: [],
					openedTabs: this.getOpenedTabsInfo(),
				})
				this.filePaths.clear()
				this.prevWorkSpacePath = this.cwd
				this.initializeFilePaths()
			}
		}, 300) // Debounce for 300ms
	}

	private workspaceDidUpdate() {
		if (this.updateTimer) {
			clearTimeout(this.updateTimer)
		}
		this.updateTimer = setTimeout(() => {
			if (!this.cwd) {
				return
			}

			const relativeFilePaths = Array.from(this.filePaths).map((file) => toRelativePath(file, this.cwd))
			const provider = this.providerRef.deref()
			provider?.postMessageToWebview({
				type: "workspaceUpdated",
				uri: this.cwd,
				filePaths: relativeFilePaths,
				openedTabs: this.getOpenedTabsInfo(),
			})
			// Dual-write: MST store
			getBackendRootStore().foundation.windowManager.setWorkspaceStore({
				filePaths: relativeFilePaths,
				openedTabs: this.getOpenedTabsInfo(),
			})
			this.updateTimer = null
		}, 300) // Debounce for 300ms
	}

	private normalizeFilePath(filePath: string): string {
		const resolvedPath = this.cwd ? path.resolve(this.cwd, filePath) : path.resolve(filePath)
		return filePath.endsWith("/") ? resolvedPath + "/" : resolvedPath
	}

	private async addFilePath(filePath: string): Promise<string> {
		// Allow for some buffer to account for files being created/deleted during a task
		if (this.filePaths.size >= MAX_INITIAL_FILES * 2) {
			return filePath
		}

		const normalizedPath = this.normalizeFilePath(filePath)
		try {
			// D4e (plan section 3.2 Strategy E): directory detection via node:fs instead of the host
			// vscode.workspace.fs.stat.
			const stats = await stat(normalizedPath)
			const isDirectory = stats.isDirectory()
			const pathWithSlash = isDirectory && !normalizedPath.endsWith("/") ? normalizedPath + "/" : normalizedPath
			this.filePaths.add(pathWithSlash)
			return pathWithSlash
		} catch {
			// If stat fails, assume it is a file (this can happen for newly created files)
			this.filePaths.add(normalizedPath)
			return normalizedPath
		}
	}

	private async removeFilePath(filePath: string): Promise<boolean> {
		const normalizedPath = this.normalizeFilePath(filePath)
		return this.filePaths.delete(normalizedPath) || this.filePaths.delete(normalizedPath + "/")
	}

	public dispose() {
		this.disposed = true
		if (this.updateTimer) {
			clearTimeout(this.updateTimer)
			this.updateTimer = null
		}
		if (this.resetTimer) {
			clearTimeout(this.resetTimer)
			this.resetTimer = null
		}
		this.disposables.forEach((d) => d.dispose())
		this.disposables = [] // Clear the array
	}
}

export default WorkspaceTracker
