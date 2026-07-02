import React, { useMemo, useState, useEffect } from "react"
import { MarketplaceItem, TelemetryEventName } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import { telemetryClient } from "@/features/cloud/utils/TelemetryClient"
import { ViewState } from "../state/MarketplaceViewStateManager"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Button } from "@src/shared/ui/buttons/button"
import { MarketplaceInstallModal } from "../install/MarketplaceInstallModal"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@src/shared/ui/overlays/alert-dialog"
import { ItemNameDisplay, MarketplaceTagsSection, AuthorInfo } from "./MarketplaceItemCardComponents"

interface ItemInstalledMetadata {
	type: string
}
interface MarketplaceItemCardProps {
	item: MarketplaceItem
	filters: ViewState["filters"]
	setFilters: (filters: Partial<ViewState["filters"]>) => void
	installed: { project: ItemInstalledMetadata | undefined; global: ItemInstalledMetadata | undefined }
}

export const MarketplaceItemCard: React.FC<MarketplaceItemCardProps> = ({ item, filters, setFilters, installed }) => {
	const { t } = useAppTranslation()
	const cwd = rootStore.extensionState.cwd
	const [showInstallModal, setShowInstallModal] = useState(false)
	const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
	const [removeTarget, setRemoveTarget] = useState<"project" | "global">("project")
	const [removeError, setRemoveError] = useState<string | null>(null)

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "marketplaceRemoveResult" && message.slug === item.id) {
				if (message.success) {
					rootStore.marketplace.fetchMarketplaceData()
				} else {
					setRemoveError(message.error || t("marketplace:items.unknownError"))
				}
			}
		}
		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [item.id, t])

	const typeLabel = useMemo(() => {
		const labels: Partial<Record<MarketplaceItem["type"], string>> = {
			mode: t("marketplace:filters.type.mode"),
			mcp: t("marketplace:filters.type.mcpServer"),
		}
		return labels[item.type] ?? "N/A"
	}, [item.type, t])
	const isInstalledGlobally = !!installed.global
	const isInstalledInProject = !!installed.project
	const isInstalled = isInstalledGlobally || isInstalledInProject

	const handleInstallClick = () => {
		telemetryClient.capture(TelemetryEventName.MARKETPLACE_INSTALL_BUTTON_CLICKED, {
			itemId: item.id,
			itemType: item.type,
			itemName: item.name,
		})
		setShowInstallModal(true)
	}

	return (
		<>
			<div className="border border-vscode-panel-border rounded-xl cursor-default p-3 transition-colors bg-vscode-editor-background hover:bg-vscode-editor-foreground/5">
				<div className="flex gap-2 items-start justify-between">
					<div className="flex gap-2 items-start">
						<div>
							<h3 className="text-lg font-semibold text-vscode-foreground mt-0 mb-1 leading-none">
								<ItemNameDisplay item={item} />
							</h3>
							<AuthorInfo item={item} typeLabel={typeLabel} />
						</div>
					</div>
					<div className="flex items-center gap-1">
						{isInstalled ? (
							<Button
								size="sm"
								variant="secondary"
								className="text-xs h-5 py-0 px-2"
								onClick={() => {
									const target = isInstalledInProject ? "project" : "global"
									setRemoveTarget(target)
									setShowRemoveConfirm(true)
								}}>
								{t("marketplace:items.card.remove")}
							</Button>
						) : (
							<Button
								size="sm"
								variant="primary"
								className="text-xs h-5 py-0 px-2"
								onClick={handleInstallClick}>
								{t("marketplace:items.card.install")}
							</Button>
						)}
						{removeError && (
							<div className="text-vscode-errorForeground text-sm mt-2">
								{t("marketplace:items.removeFailed", { error: removeError })}
							</div>
						)}
					</div>
				</div>
				<p className="my-2 text-vscode-foreground">{item.description}</p>
				<MarketplaceTagsSection
					item={item}
					filters={filters}
					setFilters={setFilters}
					isInstalled={isInstalled}
				/>
			</div>
			<MarketplaceInstallModal
				item={item}
				isOpen={showInstallModal}
				onClose={() => setShowInstallModal(false)}
				hasWorkspace={!!cwd}
			/>
			<AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{item.type === "mode"
								? t("marketplace:removeConfirm.mode.title")
								: t("marketplace:removeConfirm.mcp.title")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{item.type === "mode" ? (
								<>
									{t("marketplace:removeConfirm.mode.message", { modeName: item.name })}
									<div className="mt-2 text-sm">
										{t("marketplace:removeConfirm.mode.rulesWarning")}
									</div>
								</>
							) : (
								t("marketplace:removeConfirm.mcp.message", { mcpName: item.name })
							)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t("marketplace:removeConfirm.cancel")}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setRemoveError(null)
								rootStore.marketplace.removeInstalledMarketplaceItem(item, { target: removeTarget })
								setShowRemoveConfirm(false)
							}}>
							{t("marketplace:removeConfirm.confirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
