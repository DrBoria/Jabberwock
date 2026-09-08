import type { IUri } from "@jabberwock/types"
import { getBackendCapabilities } from "@features/foundation/capabilities/registry"
import * as path from "path"

export interface ExportContext {
	getValue(key: string): unknown
	setValue(key: string, value: unknown): void | PromiseLike<void>
}

export interface ExportOptions {
	/**
	 * Whether to consider the active workspace folder as a default location.
	 * Default: true
	 */
	useWorkspace?: boolean
	/**
	 * Fallback directory if no previous path or workspace is available.
	 */
	fallbackDir?: string
}

/**
 * Resolves the default save URI for an export operation.
 * Priorities:
 * 1. Last used export path (if available)
 * 2. Active workspace folder (if useWorkspace is true)
 * 3. Fallback directory (e.g. Downloads or Documents)
 * 4. Default to just the filename (user's home/cwd)
 */
export function resolveDefaultSaveUri(
	context: ExportContext,
	configKey: string,
	fileName: string,
	options: ExportOptions = {},
): IUri {
	const { useWorkspace = true, fallbackDir } = options
	const lastExportPath = context.getValue(configKey) as string | undefined

	if (lastExportPath) {
		// Use the directory from the last export
		const lastDir = path.dirname(lastExportPath)
		return { fsPath: path.join(lastDir, fileName) }
	} else {
		// Try workspace if enabled
		const workspaceFolders = getBackendCapabilities().hostContext.workspaceFolders
		if (useWorkspace && workspaceFolders && workspaceFolders.length > 0) {
			return { fsPath: path.join(workspaceFolders[0], fileName) }
		}

		// Fallback
		if (fallbackDir) {
			return { fsPath: path.join(fallbackDir, fileName) }
		}

		// Default to cwd/home
		return { fsPath: fileName }
	}
}

export async function saveLastExportPath(context: ExportContext, configKey: string, uri: IUri) {
	await context.setValue(configKey, uri.fsPath)
}
