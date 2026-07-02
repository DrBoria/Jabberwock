import React from "react"
import { observer } from "mobx-react-lite"
import { Trans } from "react-i18next"
import { Plus, Folder, Globe } from "lucide-react"
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
import { Button } from "@src/shared/ui/buttons/button"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { buildDocLink } from "@/utils/misc/docLinks"
import { SectionHeader } from "../shared/SectionHeader"
import { CreateSkillDialog } from "../CreateSkillDialog/CreateSkillDialogComponent"
import { useSkillsSettings } from "./useSkillsSettings"
import { SkillItem } from "./SkillItem"
import { SkillModeDialog } from "./SkillModeDialog"

export const SkillsSettings: React.FC = observer(() => {
	const { t } = useAppTranslation()
	const {
		hasWorkspace,
		projectSkills,
		globalSkills,
		deleteDialogOpen,
		setDeleteDialogOpen,
		skillToDelete,
		createDialogOpen,
		setCreateDialogOpen,
		modeDialogOpen,
		setModeDialogOpen,
		selectedModes,
		isAnyMode,
		availableModes,
		handleDeleteClick,
		handleDeleteConfirm,
		handleDeleteCancel,
		handleEditClick,
		handleOpenModeDialog,
		handleAnyModeToggle,
		handleModeToggle,
		handleSaveModes,
		handleCloseModeDialog,
	} = useSkillsSettings()

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="flex-shrink-0">
				<SectionHeader>{t("settings:sections.skills")}</SectionHeader>
				<div className="flex flex-col gap-2 px-5 py-2">
					<p className="text-vscode-descriptionForeground text-sm m-0">
						<Trans
							i18nKey="settings:skills.description"
							components={{
								DocsLink: (
									<a
										href={buildDocLink("features/skills", "skills_settings")}
										target="_blank"
										rel="noopener noreferrer"
										className="text-vscode-textLink-foreground hover:underline">
										Docs
									</a>
								),
							}}
						/>
					</p>
					<Button variant="secondary" className="py-1" onClick={() => setCreateDialogOpen(true)}>
						<Plus />
						{t("settings:skills.addSkill")}
					</Button>
				</div>
			</div>
			<div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
				<div className="flex flex-col gap-1">
					{hasWorkspace && (
						<>
							<div className="flex items-center gap-2 px-2 py-2 mt-2 cursor-default">
								<Folder className="size-4 shrink-0" />
								<span className="font-medium text-lg">{t("settings:skills.workspaceSkills")}</span>
							</div>
							{projectSkills.length > 0 ? (
								projectSkills.map((skill) => (
									<SkillItem
										key={`${skill.source}-${skill.name}-${skill.modeSlugs?.join(",") || "any"}`}
										skill={skill}
										onEdit={handleEditClick}
										onDelete={handleDeleteClick}
										onOpenModeDialog={handleOpenModeDialog}
										t={t}
									/>
								))
							) : (
								<div className="px-2 pb-4 text-sm text-vscode-descriptionForeground cursor-default">
									{t("settings:skills.noWorkspaceSkills")}
								</div>
							)}
						</>
					)}
					<div className="flex items-center gap-2 px-2 py-2 mt-2 cursor-default">
						<Globe className="size-4 shrink-0" />
						<span className="font-medium text-lg">{t("settings:skills.globalSkills")}</span>
					</div>
					{globalSkills.length > 0 ? (
						globalSkills.map((skill) => (
							<SkillItem
								key={`${skill.source}-${skill.name}-${skill.modeSlugs?.join(",") || "any"}`}
								skill={skill}
								onEdit={handleEditClick}
								onDelete={handleDeleteClick}
								onOpenModeDialog={handleOpenModeDialog}
								t={t}
							/>
						))
					) : (
						<div className="px-2 pb-4 text-sm text-vscode-descriptionForeground cursor-default">
							{t("settings:skills.noGlobalSkills")}
						</div>
					)}
				</div>
			</div>
			<div className="px-6 py-1 text-sm border-t border-vscode-panel-border text-muted-foreground">
				<Trans
					i18nKey="settings:skills.footer"
					components={{
						MarketplaceLink: (
							<span
								onClick={() => {
									window.postMessage(
										{
											type: "action",
											action: "marketplaceButtonClicked",
											values: { marketplaceTab: "mode" },
										},
										"*",
									)
								}}
								className="text-vscode-textLink-foreground hover:underline cursor-pointer"
							/>
						),
					}}
				/>
			</div>
			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("settings:skills.deleteDialog.title")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("settings:skills.deleteDialog.description", { name: skillToDelete?.name })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={handleDeleteCancel}>
							{t("settings:skills.deleteDialog.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction onClick={handleDeleteConfirm}>
							{t("settings:skills.deleteDialog.confirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			<CreateSkillDialog
				open={createDialogOpen}
				onOpenChange={setCreateDialogOpen}
				onSkillCreated={() => {}}
				hasWorkspace={hasWorkspace}
			/>
			<SkillModeDialog
				open={modeDialogOpen}
				onOpenChange={setModeDialogOpen}
				isAnyMode={isAnyMode}
				selectedModes={selectedModes}
				availableModes={availableModes}
				onAnyModeToggle={handleAnyModeToggle}
				onModeToggle={handleModeToggle}
				onSave={handleSaveModes}
				onClose={handleCloseModeDialog}
				t={t}
			/>
		</div>
	)
})
