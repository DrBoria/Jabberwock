import React from "react"
import { Button } from "@src/shared/ui/buttons/button"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@src/shared/ui/overlays/alert-dialog"
import { rootStore } from "@src/features/store"
import type { IndexingStatus } from "@jabberwock/types"

interface PopoverActionsProps {
	currentSettings: { codebaseIndexEnabled: boolean }
	indexingStatus: IndexingStatus
	saveStatus: "idle" | "saving" | "saved" | "error"
	hasUnsavedChanges: boolean
	handleSaveSettings: () => void
	saveError: string | null
	t: (key: string, options?: Record<string, unknown>) => string
}

export const PopoverToggleSection: React.FC<{
	currentSettings: { codebaseIndexEnabled: boolean }
	indexingStatus: IndexingStatus
	t: (key: string, options?: Record<string, unknown>) => string
}> = ({ currentSettings, indexingStatus, t }) => (
	<>
		{currentSettings.codebaseIndexEnabled && (
			<div className="flex items-center gap-2 pt-4 pb-1">
				<input
					type="checkbox"
					id="auto-enable-default-toggle"
					checked={indexingStatus.autoEnableDefault ?? true}
					onChange={(e) => rootStore.settings.setAutoEnableDefault((e.target as HTMLInputElement).checked)}
					className="accent-vscode-focusBorder"
				/>
				<label htmlFor="auto-enable-default-toggle" className="text-xs text-vscode-foreground cursor-pointer">
					{t("settings:codeIndex.autoEnableDefaultLabel")}
				</label>
			</div>
		)}

		{currentSettings.codebaseIndexEnabled && (
			<div className="flex items-center gap-2 pt-1 pb-2">
				<input
					type="checkbox"
					id="workspace-indexing-toggle"
					checked={indexingStatus.workspaceEnabled ?? false}
					onChange={(e) => rootStore.settings.toggleWorkspaceIndexing((e.target as HTMLInputElement).checked)}
					className="accent-vscode-focusBorder"
				/>
				<label htmlFor="workspace-indexing-toggle" className="text-xs text-vscode-foreground cursor-pointer">
					{t("settings:codeIndex.workspaceToggleLabel")}
				</label>
			</div>
		)}

		{currentSettings.codebaseIndexEnabled && !indexingStatus.workspaceEnabled && (
			<p className="text-xs text-vscode-descriptionForeground pb-2">
				{t("settings:codeIndex.workspaceDisabledMessage")}
			</p>
		)}
	</>
)

const StatusActionButtons: React.FC<{
	currentSettings: { codebaseIndexEnabled: boolean }
	indexingStatus: IndexingStatus
	saveStatus: "idle" | "saving" | "saved" | "error"
	hasUnsavedChanges: boolean
	t: (key: string, options?: Record<string, unknown>) => string
}> = ({ currentSettings, indexingStatus, saveStatus, hasUnsavedChanges, t }) => {
	const enabled = currentSettings.codebaseIndexEnabled
	const status = indexingStatus.systemStatus

	if (!enabled) return null

	return (
		<>
			{(status === "Error" || status === "Standby") && (
				<Button
					onClick={() => rootStore.settings.startIndexing()}
					disabled={saveStatus === "saving" || hasUnsavedChanges}>
					{t("settings:codeIndex.startIndexingButton")}
				</Button>
			)}

			{status === "Indexing" && (
				<Button variant="destructive" onClick={() => rootStore.settings.stopIndexing()}>
					{t("settings:codeIndex.stopIndexingButton")}
				</Button>
			)}

			{status === "Stopping" && (
				<Button variant="destructive" disabled>
					{t("settings:codeIndex.stoppingButton")}
				</Button>
			)}

			{(status === "Indexed" || status === "Error") && (
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button variant="secondary">{t("settings:codeIndex.clearIndexDataButton")}</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>{t("settings:codeIndex.clearDataDialog.title")}</AlertDialogTitle>
							<AlertDialogDescription>
								{t("settings:codeIndex.clearDataDialog.description")}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>
								{t("settings:codeIndex.clearDataDialog.cancelButton")}
							</AlertDialogCancel>
							<AlertDialogAction onClick={() => rootStore.settings.clearIndexData()}>
								{t("settings:codeIndex.clearDataDialog.confirmButton")}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			)}
		</>
	)
}

export const PopoverActionButtons: React.FC<PopoverActionsProps> = ({
	currentSettings,
	indexingStatus,
	saveStatus,
	hasUnsavedChanges,
	handleSaveSettings,
	saveError,
	t,
}) => (
	<>
		<div className="flex items-center justify-between gap-2 pt-6">
			<div className="flex gap-2">
				<StatusActionButtons
					currentSettings={currentSettings}
					indexingStatus={indexingStatus}
					saveStatus={saveStatus}
					hasUnsavedChanges={hasUnsavedChanges}
					t={t}
				/>
			</div>

			<Button onClick={handleSaveSettings} disabled={!hasUnsavedChanges || saveStatus === "saving"}>
				{saveStatus === "saving" ? t("settings:codeIndex.saving") : t("settings:codeIndex.saveSettings")}
			</Button>
		</div>

		{saveStatus === "error" && (
			<div className="mt-2">
				<span className="text-sm text-vscode-errorForeground block">
					{saveError || t("settings:codeIndex.saveError")}
				</span>
			</div>
		)}
	</>
)
