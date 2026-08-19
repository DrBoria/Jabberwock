import React from "react"
import { Trans } from "react-i18next"
import { Download } from "lucide-react"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import type { ModeConfig } from "../types"
import { ModeToolbar } from "../toolbar"
import { ConfigMenu } from "../components"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { buildDocLink } from "@/utils/misc/docLinks"
import { rootStore } from "@src/features/store"
import { Button } from "@src/shared/ui/buttons/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/shared/ui/selects/select"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"

type HeaderSectionProps = {
	displayModes: ModeConfig[]
	searchValue: string
	open: boolean
	isRenamingMode: boolean
	renameInputValue: string
	isExporting: boolean
	isImporting: boolean
	showConfigMenu: boolean
	currentApiConfigName: string | undefined
	listApiConfigMeta: readonly { id: string; name: string }[] | undefined
	onOpenChange: (open: boolean) => void
	onSearchChange: (value: string) => void
	onClearSearch: () => void
	onModeSelect: (mode: ModeConfig) => void
	onStartRename: () => void
	onSaveRename: () => void
	onCancelRename: () => void
	onRenameInputChange: (value: string) => void
	onCreateMode: () => void
	onDeleteMode: () => void
	onExport: () => void
	getCurrentMode: () => ModeConfig | undefined
	setShowConfigMenu: (v: boolean | ((prev: boolean) => boolean)) => void
	setShowImportDialog: (v: boolean) => void
	setIsCreateModeDialogOpen: (v: boolean) => void
}

export const HeaderSection: React.FC<HeaderSectionProps> = ({
	displayModes,
	searchValue,
	open,
	isRenamingMode,
	renameInputValue,
	isExporting,
	isImporting,
	showConfigMenu,
	currentApiConfigName,
	listApiConfigMeta,
	onOpenChange,
	onSearchChange,
	onClearSearch,
	onModeSelect,
	onStartRename,
	onSaveRename,
	onCancelRename,
	onRenameInputChange,
	onCreateMode,
	onDeleteMode,
	onExport,
	getCurrentMode,
	setShowConfigMenu,
	setShowImportDialog,
}) => {
	const { t } = useAppTranslation()
	return (
		<div>
			<div onClick={(e) => e.stopPropagation()} className="flex justify-between items-center mb-3">
				<h3 className="text-[1.25em] font-semibold text-vscode-foreground mt-4 mb-2">
					{t("prompts:modes.title")}
				</h3>
				<div className="flex gap-2">
					<div className="relative inline-block">
						<StandardTooltip content={t("prompts:modes.editModesConfig")}>
							<Button
								variant="ghost"
								size="icon"
								className="flex"
								onClick={(e: React.MouseEvent) => {
									e.preventDefault()
									e.stopPropagation()
									setShowConfigMenu((prev) => !prev)
								}}
								onBlur={() => {
									setTimeout(() => setShowConfigMenu(false), 200)
								}}>
								<span className="codicon codicon-json" />
							</Button>
						</StandardTooltip>
						<ConfigMenu show={showConfigMenu} onClose={() => setShowConfigMenu(false)} />
					</div>
					<StandardTooltip content={t("chat:modeSelector.marketplace")}>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => {
								window.postMessage(
									{
										type: "action",
										action: "marketplaceButtonClicked",
										values: { marketplaceTab: "mode" },
									},
									"*",
								)
							}}>
							<span className="codicon codicon-extensions" />
						</Button>
					</StandardTooltip>
					<StandardTooltip content={t("prompts:modes.importMode")}>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setShowImportDialog(true)}
							disabled={isImporting}
							title={t("prompts:modes.importMode")}
							data-testid="import-mode-toolbar-button">
							<Download className="h-4 w-4" />
						</Button>
					</StandardTooltip>
				</div>
			</div>
			<div className="text-sm text-vscode-descriptionForeground mb-3">
				<Trans i18nKey="prompts:modes.createModeHelpText">
					<VSCodeLink
						href={buildDocLink("basic-usage/using-modes", "prompts_view_modes")}
						style={{ display: "inline" }}
						aria-label="Learn about using modes"
					/>
					<VSCodeLink
						href={buildDocLink("features/custom-modes", "prompts_view_modes")}
						style={{ display: "inline" }}
						aria-label="Learn about customizing modes"
					/>
				</Trans>
			</div>
			<ModeToolbar
				displayModes={displayModes}
				searchValue={searchValue}
				open={open}
				isRenamingMode={isRenamingMode}
				renameInputValue={renameInputValue}
				isExporting={isExporting}
				onOpenChange={onOpenChange}
				onSearchChange={onSearchChange}
				onClearSearch={onClearSearch}
				onModeSelect={onModeSelect}
				onStartRename={onStartRename}
				onSaveRename={onSaveRename}
				onCancelRename={onCancelRename}
				onRenameInputChange={onRenameInputChange}
				onCreateMode={onCreateMode}
				onDeleteMode={onDeleteMode}
				onExport={onExport}
				getCurrentMode={getCurrentMode}
			/>
			<div className="mb-3">
				<div className="font-bold mb-1">{t("prompts:apiConfiguration.title")}</div>
				<div className="text-sm text-vscode-descriptionForeground mb-2">
					{t("prompts:apiConfiguration.select")}
				</div>
				<div className="mb-2">
					<Select
						value={currentApiConfigName}
						onValueChange={(value) => {
							rootStore.settings.loadApiConfig(value)
						}}>
						<SelectTrigger className="w-full">
							<SelectValue placeholder={t("settings:common.select")} />
						</SelectTrigger>
						<SelectContent>
							{(listApiConfigMeta || []).map((config) => (
								<SelectItem key={config.id} value={config.name}>
									{config.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>
		</div>
	)
}
