import * as vscode from "vscode"

import type { MarketplaceItem } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"
import { t } from "@i18n"

import { SimpleInstaller } from "./SimpleInstaller"

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

	vscode.window.showInformationMessage(t("marketplace:installation.installing", { itemName: item.name }))

	try {
		const result = await installer.installItem(item, { target, parameters })
		vscode.window.showInformationMessage(t("marketplace:installation.installSuccess", { itemName: item.name }))

		const telemetryProperties = buildTelemetryProperties(parameters, item)

		getTelemetryService().captureMarketplaceItemInstalled(
			item.id,
			item.type,
			item.name,
			target,
			telemetryProperties,
		)

		const document = await vscode.workspace.openTextDocument(result.filePath)
		const options: vscode.TextDocumentShowOptions = {}

		if (result.line !== undefined) {
			options.selection = new vscode.Range(result.line - 1, 0, result.line - 1, 0)
		}

		await vscode.window.showTextDocument(document, options)

		return result.filePath
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		vscode.window.showErrorMessage(
			t("marketplace:installation.installError", { itemName: item.name, errorMessage }),
		)
		throw error
	}
}

export async function removeInstalledMarketplaceItem(
	item: MarketplaceItem,
	installer: SimpleInstaller,
	options?: { target?: "global" | "project" },
): Promise<void> {
	const { target = "project" } = options || {}

	vscode.window.showInformationMessage(t("marketplace:installation.removing", { itemName: item.name }))

	try {
		await installer.removeItem(item, { target })
		vscode.window.showInformationMessage(t("marketplace:installation.removeSuccess", { itemName: item.name }))

		getTelemetryService().captureMarketplaceItemRemoved(item.id, item.type, item.name, target)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		vscode.window.showErrorMessage(t("marketplace:installation.removeError", { itemName: item.name, errorMessage }))
		throw error
	}
}
