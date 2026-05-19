import type { EventBridge } from "../../core/webview/EventBridge"
import type { WebviewMessage } from "@jabberwock/types"
import { MarketplaceManager, MarketplaceItemType } from "../../services/marketplace"
import type { MarketplaceItem } from "@jabberwock/types"
import * as vscode from "vscode"

import { postStateToWebview } from "../foundation/window-manager/store"

interface MarketplaceMessage {
	type: string
	marketplaceManager?: MarketplaceManager
	filters?: Record<string, unknown>
	mpItem?: Record<string, unknown>
	mpInstallOptions?: Record<string, unknown>
	payload?: Record<string, unknown>
}

export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

export const handlerMap: Record<string, HandlerFn> = {
	filterMarketplaceItems: async (provider, message) => {
		const msg = message as MarketplaceMessage
		const marketplaceManager = msg.marketplaceManager as MarketplaceManager | undefined
		const filters = msg.filters as Record<string, unknown> | undefined
		if (marketplaceManager && filters) {
			try {
				await marketplaceManager.updateWithFilteredItems({
					type: filters.type as MarketplaceItemType | undefined,
					search: filters.search as string | undefined,
					tags: filters.tags as string[] | undefined,
				})
				await postStateToWebview(provider)
			} catch (error) {
				console.error("Marketplace: Error filtering items:", error)
				vscode.window.showErrorMessage("Failed to filter marketplace items")
			}
		}
	},

	installMarketplaceItem: async (provider, message) => {
		const msg = message as MarketplaceMessage
		const marketplaceManager = msg.marketplaceManager as MarketplaceManager | undefined
		const mpItem = msg.mpItem as Record<string, unknown> | undefined
		const mpInstallOptions = msg.mpInstallOptions as Record<string, unknown> | undefined
		if (marketplaceManager && mpItem && mpInstallOptions) {
			try {
				const configFilePath = await marketplaceManager.installMarketplaceItem(
					mpItem as MarketplaceItem,
					mpInstallOptions as { target?: "global" | "project"; parameters?: Record<string, unknown> },
				)
				await postStateToWebview(provider)
				console.log(`Marketplace item installed and config file opened: ${configFilePath}`)
				provider.postMessageToWebview({
					type: "marketplaceInstallResult",
					success: true,
					slug: mpItem.id as string,
				})
			} catch (error) {
				console.error(`Error installing marketplace item: ${error}`)
				provider.postMessageToWebview({
					type: "marketplaceInstallResult",
					success: false,
					error: error instanceof Error ? error.message : String(error),
					slug: mpItem!.id as string,
				})
			}
		}
	},

	installMarketplaceItemWithParameters: async (provider, message) => {
		const msg = message as MarketplaceMessage
		const marketplaceManager = msg.marketplaceManager as MarketplaceManager | undefined
		const payload = msg.payload as Record<string, unknown> | undefined
		if (marketplaceManager && payload && "item" in payload && "parameters" in payload) {
			try {
				const configFilePath = await marketplaceManager.installMarketplaceItem(
					payload.item as MarketplaceItem,
					{ parameters: payload.parameters as Record<string, unknown> },
				)
				await postStateToWebview(provider)
				console.log(`Marketplace item with parameters installed and config file opened: ${configFilePath}`)
			} catch (error) {
				console.error(`Error installing marketplace item with parameters: ${error}`)
				vscode.window.showErrorMessage(
					`Failed to install marketplace item: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}
	},

	removeInstalledMarketplaceItem: async (provider, message) => {
		const msg = message as MarketplaceMessage
		const marketplaceManager = msg.marketplaceManager as MarketplaceManager | undefined
		const mpItem = msg.mpItem as Record<string, unknown> | undefined
		const mpInstallOptions = msg.mpInstallOptions as Record<string, unknown> | undefined
		if (marketplaceManager && mpItem && mpInstallOptions) {
			try {
				await marketplaceManager.removeInstalledMarketplaceItem(
					mpItem as MarketplaceItem,
					mpInstallOptions as { target?: "global" | "project" },
				)
				await postStateToWebview(provider)
				provider.postMessageToWebview({
					type: "marketplaceRemoveResult",
					success: true,
					slug: mpItem.id as string,
				})
			} catch (error) {
				console.error(`Error removing marketplace item: ${error}`)

				vscode.window.showErrorMessage(
					`Failed to remove marketplace item: ${error instanceof Error ? error.message : String(error)}`,
				)
				provider.postMessageToWebview({
					type: "marketplaceRemoveResult",
					success: false,
					error: error instanceof Error ? error.message : String(error),
					slug: mpItem.id as string,
				})
			}
		} else {
			const errorMessage = !marketplaceManager
				? "Marketplace manager is not available"
				: "Missing required parameters for marketplace item removal"
			console.error(errorMessage)

			vscode.window.showErrorMessage(errorMessage)

			if (mpItem?.id) {
				provider.postMessageToWebview({
					type: "marketplaceRemoveResult",
					success: false,
					error: errorMessage,
					slug: mpItem.id as string,
				})
			}
		}
	},

	fetchMarketplaceData: async (_provider, _message) => {
		// fetchMarketplaceData was removed from EventBridge - no-op for now
		console.warn("fetchMarketplaceData handler called but method is no longer available")
	},

	refreshCustomTools: async (provider, message) => {
		try {
			const { getRooDirectoriesForCwd } = await import("../../services/jabberwock-config/index.js")
			const currentCline = provider.getCurrentTask()
			const cwd = currentCline?.cwd || provider.cwd
			const { customToolRegistry } = await import("@jabberwock/core")
			const toolDirs = getRooDirectoriesForCwd(cwd).map((dir: string) => path.join(dir, "tools"))
			await customToolRegistry.loadFromDirectories(toolDirs)

			await provider.postMessageToWebview({
				type: "customToolsResult",
				tools: customToolRegistry.getAllSerialized(),
			})
		} catch (error) {
			await provider.postMessageToWebview({
				type: "customToolsResult",
				tools: [],
				error: error instanceof Error ? error.message : String(error),
			})
		}
	},

	cancelMarketplaceInstall: async (_provider, _message) => {
		// No-op or future implementation
	},

	marketplaceButtonClicked: async (provider, _message) => {
		provider.postMessageToWebview({ type: "action", action: "marketplaceButtonClicked" })
	},
}

import * as path from "path"
import { getRooDirectoriesForCwd } from "../../services/jabberwock-config/index.js"
import { customToolRegistry } from "@jabberwock/core"
