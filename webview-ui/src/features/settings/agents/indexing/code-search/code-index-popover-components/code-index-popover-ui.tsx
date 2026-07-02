import { Trans } from "react-i18next"
import { VSCodeCheckbox, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { AlertTriangle } from "lucide-react"

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
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { buildDocLink } from "@/utils/misc/docLinks"

import { STATUS_COLORS } from "../code-index-popover-logic/code-index-popover-constants"
import type { IndexingStatus } from "@jabberwock/types"

interface PopoverHeaderProps {
	t: (key: string, options?: Record<string, unknown>) => string
}

export const PopoverHeader = ({ t }: PopoverHeaderProps) => (
	<div className="p-3 border-b border-vscode-dropdown-border cursor-default">
		<div className="flex flex-row items-center gap-1 p-0 mt-0 mb-1 w-full">
			<h4 className="m-0 pb-2 flex-1">{t("settings:codeIndex.title")}</h4>
		</div>
		<p className="my-0 pr-4 text-sm w-full">
			<Trans i18nKey="settings:codeIndex.description">
				<VSCodeLink
					href={buildDocLink("features/experimental/codebase-indexing", "settings")}
					style={{ display: "inline" }}
				/>
			</Trans>
		</p>
	</div>
)

interface EnableCheckboxProps {
	checked: boolean
	onChange: (checked: boolean) => void
	t: (key: string, options?: Record<string, unknown>) => string
}

export const EnableCheckbox = ({ checked, onChange, t }: EnableCheckboxProps) => (
	<div className="mb-4">
		<div className="flex items-center gap-2">
			<VSCodeCheckbox checked={checked} onChange={(e) => onChange((e.target as HTMLInputElement).checked)}>
				<span className="font-medium">{t("settings:codeIndex.enableLabel")}</span>
			</VSCodeCheckbox>
			<StandardTooltip content={t("settings:codeIndex.enableDescription")}>
				<span className="codicon codicon-info text-xs text-vscode-descriptionForeground cursor-help" />
			</StandardTooltip>
		</div>
	</div>
)

interface IndexingStatusSectionProps {
	indexingStatus: IndexingStatus
	progressPercentage: number
	t: (key: string, options?: Record<string, unknown>) => string
}

export const IndexingStatusSection = ({ indexingStatus, progressPercentage, t }: IndexingStatusSectionProps) => (
	<div className="space-y-2">
		<h4 className="text-sm font-medium">{t("settings:codeIndex.statusTitle")}</h4>
		<div className="text-sm text-vscode-descriptionForeground">
			<span
				className={`inline-block w-3 h-3 rounded-full mr-2 ${STATUS_COLORS[indexingStatus.systemStatus] || "bg-gray-400"}`}
			/>
			{t(`settings:codeIndex.indexingStatuses.${indexingStatus.systemStatus.toLowerCase()}`)}
			{indexingStatus.message ? ` - ${indexingStatus.message}` : ""}
		</div>
		{indexingStatus.systemStatus === "Indexing" && (
			<div className="mt-2">
				<ProgressPrimitive.Root
					className="relative h-2 w-full overflow-hidden rounded-full bg-secondary"
					value={progressPercentage}>
					<ProgressPrimitive.Indicator
						className="h-full w-full flex-1 bg-primary transition-transform duration-300 ease-in-out"
						style={{ transform: `translateX(-${100 - progressPercentage}%)` }}
					/>
				</ProgressPrimitive.Root>
			</div>
		)}
	</div>
)

interface UnsavedChangesDialogProps {
	isDiscardDialogShow: boolean
	setDiscardDialogShow: (show: boolean) => void
	onConfirmDialogResult: (confirm: boolean) => void
	t: (key: string, options?: Record<string, unknown>) => string
}

export const UnsavedChangesDialog = ({
	isDiscardDialogShow,
	setDiscardDialogShow,
	onConfirmDialogResult,
	t,
}: UnsavedChangesDialogProps) => (
	<AlertDialog open={isDiscardDialogShow} onOpenChange={setDiscardDialogShow}>
		<AlertDialogContent>
			<AlertDialogHeader>
				<AlertDialogTitle className="flex items-center gap-2">
					<AlertTriangle className="w-5 h-5 text-yellow-500" />
					{t("settings:unsavedChangesDialog.title")}
				</AlertDialogTitle>
				<AlertDialogDescription>{t("settings:unsavedChangesDialog.description")}</AlertDialogDescription>
			</AlertDialogHeader>
			<AlertDialogFooter>
				<AlertDialogCancel onClick={() => onConfirmDialogResult(false)}>
					{t("settings:unsavedChangesDialog.cancelButton")}
				</AlertDialogCancel>
				<AlertDialogAction onClick={() => onConfirmDialogResult(true)}>
					{t("settings:unsavedChangesDialog.discardButton")}
				</AlertDialogAction>
			</AlertDialogFooter>
		</AlertDialogContent>
	</AlertDialog>
)
