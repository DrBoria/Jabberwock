import type { MarketplaceItem } from "@jabberwock/types"

import { getTelemetryService } from "@jabberwock/telemetry"

import { t } from "@i18n"

import { SimpleInstaller } from "./SimpleInstaller"

import { getBackendCapabilities, getUiDialogs, publishNotificationError } from "@features/foundation/capabilities"

/**
 * Show an informational toast through the UI-dialogs capability slot (G6/G7 purity:
 * no direct `vscode.window` import). Server mode degrades to a no-op.
 */
function notifyInfo(message: string): void {
	void getUiDialogs().showInformationMessage(message)
}

/**
 * Open a file in the host editor through the host-context command slot (G6/G7 purity).
 * `line` is 1-based; the connector slot converts to a 0-based selection. Server mode no-ops.
 */
function openInEditor(filePath: string, line?: number): void {
	const selection = line !== undefined ? { line } : undefined
	getBackendCapabilities().hostContext.hostCommands?.openFileInEditor?.(filePath, selection)
}

function buildTelemetryProperties(
	parameters: { [key: string]: unknown } | undefined,
	item: MarketplaceItem,
): { [key: string]: unknown } {
	const telemetryProperties: { [key: string]: unknown } = {}
	if (parameters && Object.keys(parameters).length > 0) {
		telemetryProperties.hasParameters = true
		if (item.type === "mcp" && parameters._selectedIndex !== undefined && Array.isArray(item.content)) {
			const selectedMethod = item.content[parameters._selectedIndex as number]
			if (selectedMethod && selectedMethod.name) {
				telemetryProperties.installationMethodName = selectedMethod.name
			}
		}
	}
	return telemetryProperties
}

export async function installMarketplaceItem(
	item: MarketplaceItem,
	installer: SimpleInstaller,
	options?: { target?: "global" | "project"; parameters?: { [key: string]: unknown } },
): Promise<string> {
	const { target = "project", parameters } = options || {}

	notifyInfo(t("marketplace:installation.installing", { itemName: item.name }))

	try {
		const result = await installer.installItem(item, { target, parameters })
		notifyInfo(t("marketplace:installation.installSuccess", { itemName: item.name }))

		const telemetryProperties = buildTelemetryProperties(parameters, item)

		getTelemetryService().captureMarketplaceItemInstalled(
			item.id,
			item.type,
			item.name,
			target,
			telemetryProperties,
		)

		openInEditor(result.filePath, result.line)

		return result.filePath
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		publishNotificationError(t("marketplace:installation.installError", { itemName: item.name, errorMessage }))
		throw error
	}
}

export async function removeInstalledMarketplaceItem(
	item: MarketplaceItem,
	installer: SimpleInstaller,
	options?: { target?: "global" | "project" },
): Promise<void> {
	const { target = "project" } = options || {}

	notifyInfo(t("marketplace:installation.removing", { itemName: item.name }))

	try {
		await installer.removeItem(item, { target })
		notifyInfo(t("marketplace:installation.removeSuccess", { itemName: item.name }))

		getTelemetryService().captureMarketplaceItemRemoved(item.id, item.type, item.name, target)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		publishNotificationError(t("marketplace:installation.removeError", { itemName: item.name, errorMessage }))
		throw error
	}
}
