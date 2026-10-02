import * as path from "path"

import * as fs from "fs/promises"

import type { IUri } from "@jabberwock/types"

import { t } from "@i18n"

import { getHostEnvironment, getWorkspaceRoot } from "@features/foundation"

import { log as backendLog } from "@features/foundation"

import { publishNotificationError } from "@features/foundation"

import { sendExportModeResult } from "@features/settings"

/** Delete a rules folder from "disk" with error handling */
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
export async function resolveImportDefaultUri(): Promise<IUri | undefined> {
	const lastImportPath = getHostEnvironment().getGlobalState("lastModeImportPath") as string | undefined
	if (lastImportPath) {
		return { fsPath: path.dirname(lastImportPath) }
	}
	// D4g-2 (batch 3): workspace root via the host-context slot (D4e) — server mode has no
	// workspace folders, so the dialog falls back to the host default location.
	const workspaceRoot = getWorkspaceRoot()
	if (workspaceRoot) {
		return { fsPath: workspaceRoot }
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
	sendExportModeResult(provider, { success, error, slug })
}
