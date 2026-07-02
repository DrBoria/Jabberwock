import React, { useState, useEffect, useMemo, useCallback } from "react"
import { Plus, Globe, Folder } from "lucide-react"
import { Trans } from "react-i18next"

import {
	SETTINGS_REQUEST_MODES as _SETTINGS_REQUEST_MODES,
	SETTINGS_DELETE_COMMAND as _SETTINGS_DELETE_COMMAND,
	SETTINGS_OPEN_FILE as _SETTINGS_OPEN_FILE,
	SETTINGS_OPEN_COMMAND_FILE as _SETTINGS_OPEN_COMMAND_FILE,
} from "@jabberwock/types"
import type { Command } from "@jabberwock/types"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { observer } from "mobx-react-lite"
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
import { rootStore } from "@src/features/store"
import { buildDocLink } from "@/utils/misc/docLinks"

import { SectionHeader } from "../shared/SectionHeader"
import { CreateSlashCommandDialog } from "./CreateSlashCommandDialog"
import { SlashCommandItemRow } from "./SlashCommandItemRow"

export const SlashCommandsSettings: React.FC = observer(() => {
	const { t } = useAppTranslation()
	const rawCommands = rootStore.extensionCommands
	const cwd = rootStore.extensionState.cwd
	const commands = useMemo(() => rawCommands ?? [], [rawCommands])

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [commandToDelete, setCommandToDelete] = useState<Command | null>(null)
	const [createDialogOpen, setCreateDialogOpen] = useState(false)

	const hasWorkspace = Boolean(cwd)

	const handleRefresh = useCallback(() => {
		rootStore.chat.requestCommands()
	}, [])

	useEffect(() => {
		handleRefresh()
	}, [handleRefresh])

	const handleDeleteClick = useCallback((command: Command) => {
		setCommandToDelete(command)
		setDeleteDialogOpen(true)
	}, [])

	const handleDeleteConfirm = useCallback(() => {
		if (commandToDelete) {
			rootStore.settings.deleteCommand(commandToDelete.name)
			setDeleteDialogOpen(false)
			setCommandToDelete(null)
			setTimeout(handleRefresh, 100)
		}
	}, [commandToDelete, handleRefresh])

	const handleDeleteCancel = useCallback(() => {
		setDeleteDialogOpen(false)
		setCommandToDelete(null)
	}, [])

	const handleEditClick = useCallback((command: Command) => {
		if (command.filePath) {
			rootStore.settings.openFile(command.filePath)
		} else {
			rootStore.settings.openCommandFile(command.name)
		}
	}, [])

	const handleCommandCreated = useCallback(() => {
		setTimeout(handleRefresh, 500)
	}, [handleRefresh])

	const projectCommands = useMemo(() => commands.filter((cmd) => cmd.source === "project"), [commands])
	const globalCommands = useMemo(() => commands.filter((cmd) => cmd.source === "global"), [commands])

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="flex-shrink-0">
				<SectionHeader>{t("settings:sections.slashCommands")}</SectionHeader>
				<div className="flex flex-col gap-2 px-5 py-2">
					<p className="text-vscode-descriptionForeground text-sm m-0">
						<Trans
							i18nKey="settings:slashCommands.description"
							components={{
								DocsLink: (
									<a
										href={buildDocLink("features/slash-commands", "slash_commands_settings")}
										target="_blank"
										rel="noopener noreferrer"
										className="text-vscode-textLink-foreground hover:underline">
										Docs
									</a>
								),
							}}
						/>
					</p>
					<Button
						data-testid="button"
						variant="secondary"
						className="py-1"
						onClick={() => setCreateDialogOpen(true)}>
						<Plus />
						{t("settings:slashCommands.addCommand")}
					</Button>
				</div>
			</div>
			<div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
				<div className="flex flex-col gap-1">
					{hasWorkspace && (
						<>
							<div className="flex items-center gap-2 px-2 py-2 mt-2 cursor-default">
								<Folder className="size-4 shrink-0" />
								<span className="font-medium text-lg">
									{t("settings:slashCommands.workspaceCommands")}
								</span>
							</div>
							{projectCommands.length > 0 ? (
								projectCommands.map((command) => (
									<SlashCommandItemRow
										key={`${command.source}-${command.name}`}
										command={command}
										t={t}
										onEdit={handleEditClick}
										onDelete={handleDeleteClick}
									/>
								))
							) : (
								<div className="px-2 pb-4 text-sm text-vscode-descriptionForeground cursor-default">
									{t("settings:slashCommands.noWorkspaceCommands")}
								</div>
							)}
						</>
					)}
					<div className="flex items-center gap-2 px-2 py-2 mt-2 cursor-default">
						<Globe className="size-4 shrink-0" />
						<span className="font-medium text-lg">{t("settings:slashCommands.globalCommands")}</span>
					</div>
					{globalCommands.length > 0 ? (
						globalCommands.map((command) => (
							<SlashCommandItemRow
								key={`${command.source}-${command.name}`}
								command={command}
								t={t}
								onEdit={handleEditClick}
								onDelete={handleDeleteClick}
							/>
						))
					) : (
						<div className="px-2 pb-4 text-sm text-vscode-descriptionForeground cursor-default">
							{t("settings:slashCommands.noGlobalCommands")}
						</div>
					)}
				</div>
			</div>
			<div className="px-6 py-1 text-sm border-t border-vscode-panel-border text-muted-foreground">
				{t("settings:slashCommands.footer")}
			</div>
			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("settings:slashCommands.deleteDialog.title")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("settings:slashCommands.deleteDialog.description", { name: commandToDelete?.name })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={handleDeleteCancel}>
							{t("settings:slashCommands.deleteDialog.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction onClick={handleDeleteConfirm}>
							{t("settings:slashCommands.deleteDialog.confirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			<CreateSlashCommandDialog
				open={createDialogOpen}
				onOpenChange={setCreateDialogOpen}
				onCommandCreated={handleCommandCreated}
				hasWorkspace={hasWorkspace}
			/>
		</div>
	)
})
