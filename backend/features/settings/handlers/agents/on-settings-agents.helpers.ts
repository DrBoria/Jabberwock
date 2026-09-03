import * as vscode from "vscode"
import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"
import { t } from "@i18n"
import { getWorkspacePath } from "@utils/io/path"
import { getHostEnvironment } from "@features/foundation/host-context/context"
import { log as backendLog } from "@features/foundation/capabilities/backend-logger"

/** Resolve the rules folder path for a custom mode based on its scope */
export function getCustomModeRulesFolderPath(slug: string, scope: string): string {
	if (scope === "project") {
		const workspacePath = getWorkspacePath()
		if (workspacePath) {
			return path.join(workspacePath, ".jabberwock", `rules-${slug}`)
		}
		return path.join(".jabberwock", `rules-${slug}`)
	}
	const homeDir = os.homedir()
	return path.join(homeDir, ".jabberwock", `rules-${slug}`)
}

/** Delete a rules folder from disk with error handling */
export async function deleteRulesFolder(slug: string, rulesFolderPath: string): Promise<void> {
	try {
		await fs.rm(rulesFolderPath, { recursive: true, force: true })
		backendLog.info(`Deleted rules folder for mode ${slug}: ${rulesFolderPath}`)
	} catch (error) {
		backendLog.info(`Failed to delete rules folder for mode ${slug}: ${error}`)
		publishNotificationError(
			t("common:errors.delete_rules_folder_failed", {
				rulesFolderPath,
				error: error instanceof Error ? error.message : String(error),
			}),
		)
	}
}

/** Resolve default URI for the import mode file dialog */
export async function resolveImportDefaultUri(): Promise<vscode.Uri | undefined> {
	const lastImportPath = getHostEnvironment().getGlobalState("lastModeImportPath") as string | undefined
	if (lastImportPath) {
		return vscode.Uri.file(path.dirname(lastImportPath))
	}
	const workspaceFolders = vscode.workspace.workspaceFolders
	if (workspaceFolders && workspaceFolders.length > 0) {
		return vscode.Uri.file(workspaceFolders[0].uri.fsPath)
	}
	return undefined
}

/** Send export mode result to webview */
export function postExportResult(
	provider: import("@jabberwock/types").WebviewProvider,
	slug: string,
	success: boolean,
	error?: string,
): void {
	provider.postMessageToWebview({
		type: "exportModeResult",
		success,
		error,
		slug,
	})
}

import { publishNotificationError } from "@features/foundation/capabilities/notifications"
