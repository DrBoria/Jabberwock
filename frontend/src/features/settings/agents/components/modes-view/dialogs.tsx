import React from "react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/shared/ui/buttons/button"

// ─── System Prompt Preview Dialog ─────────────────────────────────────────

type SystemPromptPreviewDialogProps = {
	open: boolean
	onClose: () => void
	title: string
	content: string
}

export const SystemPromptPreviewDialog: React.FC<SystemPromptPreviewDialogProps> = ({
	open,
	onClose,
	title,
	content,
}) => {
	const { t } = useAppTranslation()

	if (!open) return null

	return (
		<div className="fixed inset-0 flex justify-end bg-black/50 z-[1000]">
			<div className="w-[calc(100vw-100px)] h-full bg-vscode-editor-background shadow-md flex flex-col relative">
				<div className="flex-1 p-5 overflow-y-auto min-h-0">
					<Button variant="ghost" size="icon" onClick={onClose} className="absolute top-5 right-5">
						<span className="codicon codicon-close" />
					</Button>
					<h2 className="mb-4">{title}</h2>
					<pre className="p-2 whitespace-pre-wrap break-words font-mono text-vscode-editor-font-size text-vscode-editor-foreground bg-vscode-editor-background border border-vscode-editor-lineHighlightBorder rounded overflow-y-auto">
						{content}
					</pre>
				</div>
				<div className="flex justify-end p-3 px-5 border-t border-vscode-editor-lineHighlightBorder bg-vscode-editor-background">
					<Button variant="secondary" onClick={onClose}>
						{t("prompts:createModeDialog.close")}
					</Button>
				</div>
			</div>
		</div>
	)
}

// ─── Import Mode Dialog ───────────────────────────────────────────────────

type ImportModeDialogProps = {
	open: boolean
	importLevel: "global" | "project"
	isImporting: boolean
	onLevelChange: (level: "global" | "project") => void
	onImport: () => void
	onClose: () => void
}

export const ImportModeDialog: React.FC<ImportModeDialogProps> = ({
	open,
	importLevel,
	isImporting,
	onLevelChange,
	onImport,
	onClose,
}) => {
	const { t } = useAppTranslation()

	if (!open) return null

	return (
		<div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[1000]">
			<div className="bg-vscode-editor-background border border-vscode-editor-lineHighlightBorder rounded-lg shadow-lg p-6 max-w-md w-full">
				<h3 className="text-lg font-semibold mb-4">{t("prompts:modes.importMode")}</h3>
				<p className="text-sm text-vscode-descriptionForeground mb-4">{t("prompts:importMode.selectLevel")}</p>
				<div className="space-y-3 mb-6">
					<label className="flex items-start gap-2 cursor-pointer">
						<input
							type="radio"
							name="importLevel"
							value="project"
							className="mt-1"
							checked={importLevel === "project"}
							onChange={() => onLevelChange("project")}
						/>
						<div>
							<div className="font-medium">{t("prompts:importMode.project.label")}</div>
							<div className="text-xs text-vscode-descriptionForeground">
								{t("prompts:importMode.project.description")}
							</div>
						</div>
					</label>
					<label className="flex items-start gap-2 cursor-pointer">
						<input
							type="radio"
							name="importLevel"
							value="global"
							className="mt-1"
							checked={importLevel === "global"}
							onChange={() => onLevelChange("global")}
						/>
						<div>
							<div className="font-medium">{t("prompts:importMode.global.label")}</div>
							<div className="text-xs text-vscode-descriptionForeground">
								{t("prompts:importMode.global.description")}
							</div>
						</div>
					</label>
				</div>
				<div className="flex justify-end gap-2">
					<Button variant="secondary" onClick={onClose}>
						{t("prompts:createModeDialog.buttons.cancel")}
					</Button>
					<Button variant="primary" onClick={onImport} disabled={isImporting}>
						{isImporting ? t("prompts:importMode.importing") : t("prompts:importMode.import")}
					</Button>
				</div>
			</div>
		</div>
	)
}
