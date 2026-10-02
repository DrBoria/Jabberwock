import type { EventBridge, ProviderHandle } from "@features/foundation"
import type { IntentBus } from "@features/intents"
import { IntentType } from "@jabberwock/types"

import type { MarketplaceItem } from "@jabberwock/types"

import { MarketplaceManager, MarketplaceItemType } from "@services/marketplace"

import * as path from "path"

import { postStateToWebview } from "@features/foundation"

import { getRooDirectoriesForCwd } from "@services/jabberwock-config/config.js"

import { customToolRegistry } from "@jabberwock/core"

import { publishNotificationError } from "@features/foundation"

import {
	sendCustomToolsResult,
	sendMarketplaceButtonClicked,
	sendMarketplaceInstallResult,
	sendMarketplaceRemoveResult,
} from "@features/settings"

/**
 * Register all marketplace-related intent handlers on the bus.
 */

function registerOnMarketplaceMarketplaceItemsFilter(bus: IntentBus): void {
	bus.register(IntentType.MarketplaceItemsFilter, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as {
			marketplaceManager?: MarketplaceManager
			filters?: { [key: string]: unknown }
		}
		const marketplaceManager = payload.marketplaceManager
		const filters = payload.filters
		if (marketplaceManager && filters) {
			try {
				await marketplaceManager.updateWithFilteredItems({
					type: filters.type as MarketplaceItemType | undefined,
					search: filters.search as string | undefined,
					tags: filters.tags as string[] | undefined,
				})
				await postStateToWebview(provider)
			} catch (error) {
				console.error("[jabberwock] Marketplace: Error filtering items:", error)
				publishNotificationError("Failed to filter marketplace items")
			}
		}
	})
}

function registerOnMarketplaceMarketplaceItemInstall(bus: IntentBus): void {
	bus.register(IntentType.MarketplaceItemInstall, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as {
			marketplaceManager?: MarketplaceManager
			mpItem?: { [key: string]: unknown }
			mpInstallOptions?: { [key: string]: unknown }
		}
		const marketplaceManager = payload.marketplaceManager
		const mpItem = payload.mpItem
		const mpInstallOptions = payload.mpInstallOptions
		if (marketplaceManager && mpItem && mpInstallOptions) {
			try {
				await marketplaceManager.installMarketplaceItem(
					mpItem as MarketplaceItem,
					mpInstallOptions as { target?: "global" | "project"; parameters?: { [key: string]: unknown } },
				)
				await postStateToWebview(provider)
				console.log(`Marketplace item installed and config file opened`)
				sendMarketplaceInstallResult(provider, {
					success: true,
					slug: mpItem.id as string,
				})
			} catch (error) {
				console.error(`[jabberwock] Error installing marketplace item: ${error}`)
				sendMarketplaceInstallResult(provider, {
					success: false,
					error: error instanceof Error ? error.message : String(error),
					slug: mpItem!.id as string,
				})
			}
		}
	})
}

function registerOnMarketplaceMarketplaceItemInstallWithParameters(bus: IntentBus): void {
	bus.register(IntentType.MarketplaceItemInstallWithParameters, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as {
			marketplaceManager?: MarketplaceManager
			payload?: { [key: string]: unknown }
		}
		const marketplaceManager = payload.marketplaceManager
		const innerPayload = payload.payload
		if (marketplaceManager && innerPayload && "item" in innerPayload && "parameters" in innerPayload) {
			try {
				await marketplaceManager.installMarketplaceItem(innerPayload.item as MarketplaceItem, {
					parameters: innerPayload.parameters as { [key: string]: unknown },
				})
				await postStateToWebview(provider)
				console.log(`Marketplace item with parameters installed and config file opened`)
			} catch (error) {
				console.error(`[jabberwock] Error installing marketplace item with parameters: ${error}`)
				publishNotificationError(
					`Failed to install marketplace item: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}
	})
}

function registerOnMarketplaceMarketplaceItemRemove(bus: IntentBus): void {
	bus.register(IntentType.MarketplaceItemRemove, handleMarketplaceItemRemove)
}

function registerOnMarketplaceMarketplaceToolsRefresh(bus: IntentBus): void {
	bus.register(IntentType.MarketplaceToolsRefresh, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const currentCline = ctx.rootStore.chat.activeTask
			const cwd = currentCline?.cwd ?? ""
			const toolDirs = getRooDirectoriesForCwd(cwd).map((dir: string) => path.join(dir, "tools"))
			await customToolRegistry.loadFromDirectories(toolDirs)

			await sendCustomToolsResult(provider, {
				tools: customToolRegistry.getAllSerialized(),
			})
		} catch (error) {
			await sendCustomToolsResult(provider, {
				tools: [],
				error: error instanceof Error ? error.message : String(error),
			})
		}
	})
}

function registerOnMarketplaceMarketplaceButtonClicked(bus: IntentBus): void {
	bus.register(IntentType.MarketplaceButtonClicked, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		sendMarketplaceButtonClicked(provider)
	})
}

export function registerOnMarketplace(_bus: IntentBus): void {
	registerOnMarketplaceMarketplaceItemsFilter(_bus)
	registerOnMarketplaceMarketplaceItemInstall(_bus)
	registerOnMarketplaceMarketplaceItemInstallWithParameters(_bus)
	registerOnMarketplaceMarketplaceItemRemove(_bus)
	registerOnMarketplaceMarketplaceToolsRefresh(_bus)
	registerOnMarketplaceMarketplaceButtonClicked(_bus)
}

async function handleMarketplaceItemRemove(
	intent: { id: string; type: string; payload: { [key: string]: unknown } },
	ctx: { provider?: EventBridge },
): Promise<void> {
	const provider = ctx.provider as ProviderHandle | undefined
	if (!provider) return

	const payload = intent.payload as {
		marketplaceManager?: MarketplaceManager
		mpItem?: { [key: string]: unknown }
		mpInstallOptions?: { [key: string]: unknown }
	}
	const marketplaceManager = payload.marketplaceManager
	const mpItem = payload.mpItem
	const mpInstallOptions = payload.mpInstallOptions
	if (marketplaceManager && mpItem && mpInstallOptions) {
		await removeMarketplaceItem(provider, marketplaceManager, mpItem, mpInstallOptions)
	} else {
		await handleMarketplaceRemoveError(provider, marketplaceManager, mpItem)
	}
}

async function removeMarketplaceItem(
	provider: ProviderHandle,
	marketplaceManager: MarketplaceManager,
	mpItem: { [key: string]: unknown },
	mpInstallOptions: { [key: string]: unknown },
): Promise<void> {
	try {
		await marketplaceManager.removeInstalledMarketplaceItem(
			mpItem as MarketplaceItem,
			mpInstallOptions as { target?: "global" | "project" },
		)
		await postStateToWebview(provider)
		sendMarketplaceRemoveResult(provider, {
			success: true,
			slug: mpItem.id as string,
		})
	} catch (error) {
		console.error(`[jabberwock] Error removing marketplace item: ${error}`)
		publishNotificationError(
			`Failed to remove marketplace item: ${error instanceof Error ? error.message : String(error)}`,
		)
		sendMarketplaceRemoveResult(provider, {
			success: false,
			error: error instanceof Error ? error.message : String(error),
			slug: mpItem.id as string,
		})
	}
}

async function handleMarketplaceRemoveError(
	provider: ProviderHandle,
	marketplaceManager: MarketplaceManager | undefined,
	mpItem: { [key: string]: unknown } | undefined,
): Promise<void> {
	const errorMessage = !marketplaceManager
		? "Marketplace manager is not available"
		: "Missing required parameters for marketplace item removal"
	console.error(`[jabberwock] ${errorMessage}`)
	publishNotificationError(errorMessage)

	if (mpItem?.id) {
		sendMarketplaceRemoveResult(provider, {
			success: false,
			error: errorMessage,
			slug: mpItem.id as string,
		})
	}
}
